// The build-time half of section sync: push the site's manifest to Forma so
// its editable slots appear in the customer's /pages admin. Runs from the
// `forma-sync-sections` bin as a `postbuild` step — the frontend is the
// thing that knows which slots it renders, so it declares them on deploy.
//
// The backend flags sections missing from the manifest as orphaned rather
// than deleting them, so a failed or partial sync can never destroy content.

import type { SectionDefinition } from "./types.js";

/** Identity with types: makes forma.sections.mjs autocomplete and typecheck. */
export function defineSections(sections: SectionDefinition[]): SectionDefinition[] {
  return sections;
}

export interface SyncOptions {
  formaApiUrl: string;
  siteId: string;
  secret: string;
  sections: SectionDefinition[];
  /**
   * Which frontend this manifest belongs to, when a site row serves more
   * than one (a church's main site and its conference site). Forma only
   * orphans sections of the same scope, so each frontend's deploy leaves
   * the other's sections alone. Unset = the site's main frontend.
   */
  scope?: string;
}

/** A manifest file may export this instead of a bare array, to set a scope. */
export interface SectionManifest {
  scope?: string;
  sections: SectionDefinition[];
}

/** Identity with types for a scoped manifest (`export default defineManifest({...})`). */
export function defineManifest(manifest: SectionManifest): SectionManifest {
  return manifest;
}

export interface SyncResult {
  synced: number;
  orphaned: number;
  sections: string[];
}

export async function syncSections(options: SyncOptions): Promise<SyncResult> {
  const url = `${options.formaApiUrl.replace(/\/$/, "")}/api/schema/sync`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forma-secret": options.secret,
    },
    body: JSON.stringify({
      site_id: options.siteId,
      sections: options.sections,
      ...(options.scope ? { scope: options.scope } : {}),
    }),
  });
  const json = (await response.json().catch(() => null)) as
    | (SyncResult & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(json?.error ?? `Schema sync answered ${response.status}.`);
  }
  return json as SyncResult;
}
