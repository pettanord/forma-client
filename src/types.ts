// Shared types for Forma site frontends. These mirror what the Forma CMS
// backend actually stores and serves — when a shape changes there, it
// changes here in the same breath. The authority for section manifests is
// forma-cms/lib/page-sections/schema.ts; for content columns, schema.sql.

/** Tiptap JSON, as stored in posts.body, lessons.body and richtext fields. */
export type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: TiptapNode[];
};

export type SectionFieldType = "text" | "richtext" | "image" | "url";

export interface SectionField {
  /** lowercase-with-dashes — it becomes the content key. */
  key: string;
  label: string;
  type: SectionFieldType;
  /** Shown under the field in the Forma editor. Write it for a volunteer. */
  hint?: string;
}

/**
 * One entry in the site's section manifest (forma.sections.mjs). This is
 * what `forma-sync-sections` pushes to POST /api/schema/sync at build time,
 * and exactly what appears in the customer's /pages admin.
 */
export interface SectionDefinition {
  /** lowercase-with-dashes — becomes /pages/{key} in the admin. */
  key: string;
  label: string;
  description?: string;
  /** Site-relative path where the section renders, e.g. "/kontakt". */
  previewPath?: string;
  /**
   * Display name of the page this section sits on ("Om oss"). Sections
   * sharing a page are grouped under it in the Forma /pages admin;
   * without it the section lists flat.
   */
  page?: string;
  /**
   * ISO 639-1 language of this section's copy ("sv", "en"). A bilingual
   * site declares one section per locale and tags each — Forma turns
   * that into language tabs. Unset = every language.
   */
  locale?: string;
  fields: SectionField[];
}

/**
 * A section's published content: { fieldKey: value }. text/url/image fields
 * are strings; richtext fields are Tiptap JSON. Empty fields are simply
 * absent — always fall back per field.
 */
export type SectionContent = Record<string, string | TiptapNode>;

/** The site theme tokens (sites.theme_*), all optional by design. */
export interface SiteTheme {
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  fontFamily: string | null;
}

export interface Post {
  id: string;
  type: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: TiptapNode | null;
  cover_image_url: string | null;
  published_at: string | null;
  language: string | null;
  event_start: string | null;
  event_end: string | null;
  location: string | null;
  registration_type: "none" | "free" | "paid" | "external";
  registration_url: string | null;
  capacity: number | null;
}

export interface CarouselSlide {
  id: string;
  carousel_key: string;
  badge: string | null;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  link_label: string | null;
  link2_label: string | null;
  link2_url: string | null;
  position: number;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  tagline: string | null;
  features: string[];
  price_cents: number | null;
  coming_soon: boolean;
  promo_vimeo_id: string | null;
  position: number;
  access_type: "free" | "paid" | "planning_center_group";
  language: string | null;
}
