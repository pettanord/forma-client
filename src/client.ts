// The typed read layer every Forma site frontend shares.
//
// Reads go straight to Supabase with the ANON key — RLS limits it to
// published content by design, and the service role key must never appear
// in a site frontend in any form. Writes (registration, checkout, contact)
// never touch the database from here: they go through the Forma admin
// app's /api/* endpoints, which is what `formaApiUrl` is for.
//
// EVERY query filters on siteId. The database holds other sites' content
// too; forgetting the filter is the one unforgivable bug in a frontend,
// which is exactly why the filter lives here and not in each call site.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CarouselSlide,
  Course,
  Post,
  SectionContent,
  SiteTheme,
} from "./types.js";

export interface FormaConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** This site's row in the shared Forma project. */
  siteId: string;
  /** The Forma admin origin, e.g. "https://formacms.se" — all write paths. */
  formaApiUrl?: string;
}

export interface Forma {
  /** The underlying anon client, for queries this surface doesn't cover. */
  supabase: SupabaseClient;
  siteId: string;

  /** Published content of one section, or null when unset/unpublished. */
  getSection(key: string): Promise<SectionContent | null>;
  /** Several sections in one round trip: { key: content | null }. */
  getSections<K extends string>(keys: K[]): Promise<Record<K, SectionContent | null>>;
  /** The site's theme tokens; every field null until set in Forma. */
  getTheme(): Promise<SiteTheme>;

  getPosts(options?: {
    type?: string;
    /** Keep posts in this language plus language-neutral ones. */
    locale?: string;
    limit?: number;
  }): Promise<Post[]>;
  getPost(slug: string): Promise<Post | null>;

  getCarousel(key?: string): Promise<CarouselSlide[]>;

  getCourses(options?: { locale?: string }): Promise<Course[]>;

  /**
   * POST to a Forma API endpoint (registration, checkout, contact…).
   * Throws if `formaApiUrl` wasn't configured. Returns the parsed JSON and
   * throws on non-2xx with the server's own error message when it sent one.
   */
  api<T = unknown>(path: string, body: Record<string, unknown>): Promise<T>;
}

const POST_COLUMNS =
  "id, type, title, slug, excerpt, body, cover_image_url, published_at, language, event_start, event_end, location, registration_type, registration_url, capacity";

export function createForma(config: FormaConfig): Forma {
  const { siteId } = config;
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  async function getSection(key: string): Promise<SectionContent | null> {
    const { data } = await supabase
      .from("page_sections")
      .select("content")
      .eq("site_id", siteId)
      .eq("section_key", key)
      .maybeSingle();
    return (data?.content as SectionContent | undefined) ?? null;
  }

  return {
    supabase,
    siteId,
    getSection,

    async getSections(keys) {
      const { data } = await supabase
        .from("page_sections")
        .select("section_key, content")
        .eq("site_id", siteId)
        .in("section_key", keys);
      const byKey = new Map(
        (data ?? []).map((row) => [row.section_key as string, row.content as SectionContent])
      );
      return Object.fromEntries(
        keys.map((key) => [key, byKey.get(key) ?? null])
      ) as Record<(typeof keys)[number], SectionContent | null>;
    },

    async getTheme() {
      const { data } = await supabase
        .from("sites")
        .select(
          "theme_primary_color, theme_secondary_color, theme_logo_url, theme_hero_image_url, theme_font_family"
        )
        .eq("id", siteId)
        .maybeSingle();
      return {
        primaryColor: data?.theme_primary_color ?? null,
        secondaryColor: data?.theme_secondary_color ?? null,
        logoUrl: data?.theme_logo_url ?? null,
        heroImageUrl: data?.theme_hero_image_url ?? null,
        fontFamily: data?.theme_font_family ?? null,
      };
    },

    async getPosts(options = {}) {
      let query = supabase
        .from("posts")
        .select(POST_COLUMNS)
        .eq("site_id", siteId)
        .order("published_at", { ascending: false, nullsFirst: false });
      if (options.type) query = query.eq("type", options.type);
      if (options.locale) {
        // Language-specific rows for this locale, plus neutral ones —
        // null means "belongs in every language's view".
        query = query.or(`language.eq.${options.locale},language.is.null`);
      }
      if (options.limit) query = query.limit(options.limit);
      const { data } = await query;
      return (data ?? []) as unknown as Post[];
    },

    async getPost(slug) {
      const { data } = await supabase
        .from("posts")
        .select(POST_COLUMNS)
        .eq("site_id", siteId)
        .eq("slug", slug)
        .maybeSingle();
      return (data as unknown as Post | null) ?? null;
    },

    async getCarousel(key = "homepage-hero") {
      const { data } = await supabase
        .from("carousel_slides")
        .select(
          "id, carousel_key, badge, title, subtitle, image_url, link_url, link_label, link2_label, link2_url, position"
        )
        .eq("site_id", siteId)
        .eq("carousel_key", key)
        .order("position", { ascending: true });
      return (data ?? []) as unknown as CarouselSlide[];
    },

    async getCourses(options = {}) {
      let query = supabase
        .from("courses")
        .select(
          "id, title, slug, description, cover_image_url, tagline, features, price_cents, coming_soon, promo_vimeo_id, position, access_type, language"
        )
        .eq("site_id", siteId)
        .order("position", { ascending: true });
      if (options.locale) {
        query = query.or(`language.eq.${options.locale},language.is.null`);
      }
      const { data } = await query;
      return (data ?? []) as unknown as Course[];
    },

    async api<T>(path: string, body: Record<string, unknown>): Promise<T> {
      if (!config.formaApiUrl) {
        throw new Error(
          "formaApiUrl is not configured — pass it to createForma() to use write endpoints."
        );
      }
      const url = `${config.formaApiUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, ...body }),
      });
      const json = (await response.json().catch(() => null)) as
        | (T & { error?: string })
        | null;
      if (!response.ok) {
        throw new Error(json?.error ?? `Forma API ${path} answered ${response.status}.`);
      }
      return json as T;
    },
  };
}
