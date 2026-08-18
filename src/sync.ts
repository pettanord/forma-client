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
    body: JSON.stringify({ site_id: options.siteId, sections: options.sections }),
  });
  const json = (await response.json().catch(() => null)) as
    | (SyncResult & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(json?.error ?? `Schema sync answered ${response.status}.`);
  }
  return json as SyncResult;
}
