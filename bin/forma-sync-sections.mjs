#!/usr/bin/env node
// Pushes the site's section manifest to Forma. Wire it as `postbuild` in
// the site's package.json so every deploy re-declares its editable slots:
//
//   "postbuild": "forma-sync-sections"
//
// Reads forma.sections.mjs (default export) or forma.sections.json from
// the working directory, or a path given as the first argument.
//
// Env (same names the rest of a Forma frontend already uses):
//   NEXT_PUBLIC_FORMA_API_URL   Forma admin origin, e.g. https://formacms.se
//   NEXT_PUBLIC_FORMA_SITE_ID   this site's id
//   FORMA_SCHEMA_SYNC_SECRET    site_integrations.schema_sync_secret
//
// A MISSING secret skips with a warning instead of failing: local builds
// and preview deploys shouldn't need production credentials to compile.
// A CONFIGURED sync that fails, fails the build loudly — a slot that
// silently never registers is a slot nobody can edit and nobody notices.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { syncSections } from "../dist/sync.js";

const explicit = process.argv[2];
const candidates = explicit
  ? [explicit]
  : ["forma.sections.mjs", "forma.sections.js", "forma.sections.json"];

const manifestPath = candidates.map((c) => resolve(c)).find((p) => existsSync(p));
if (!manifestPath) {
  console.error(
    `forma-sync-sections: no manifest found (looked for ${candidates.join(", ")}).`
  );
  process.exit(1);
}

let sections;
if (manifestPath.endsWith(".json")) {
  sections = JSON.parse(await readFile(manifestPath, "utf8"));
} else {
  sections = (await import(pathToFileURL(manifestPath).href)).default;
}
if (!Array.isArray(sections)) {
  console.error(
    "forma-sync-sections: the manifest must export an array of sections (default export)."
  );
  process.exit(1);
}

// Next.js loads .env.local itself, but npm lifecycle scripts don't — so a
// local `npm run build` would miss vars that Vercel provides through the
// environment. Fill in the gaps from .env.local/.env without overriding
// anything already exported.
for (const envFile of [".env.local", ".env"]) {
  const path = resolve(envFile);
  if (!existsSync(path)) continue;
  for (const line of (await readFile(path, "utf8")).split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const formaApiUrl =
  process.env.NEXT_PUBLIC_FORMA_API_URL ?? process.env.FORMA_API_URL;
const siteId =
  process.env.NEXT_PUBLIC_FORMA_SITE_ID ?? process.env.FORMA_SITE_ID;
const secret = process.env.FORMA_SCHEMA_SYNC_SECRET;

if (!formaApiUrl || !siteId) {
  console.error(
    "forma-sync-sections: set NEXT_PUBLIC_FORMA_API_URL and NEXT_PUBLIC_FORMA_SITE_ID."
  );
  process.exit(1);
}
if (!secret) {
  console.warn(
    "forma-sync-sections: FORMA_SCHEMA_SYNC_SECRET is not set — skipping sync (fine locally; set it in the production build env)."
  );
  process.exit(0);
}

try {
  const result = await syncSections({ formaApiUrl, siteId, secret, sections });
  console.log(
    `forma-sync-sections: synced ${result.synced} section(s)` +
      (result.orphaned ? `, ${result.orphaned} orphaned` : "") +
      ` — ${result.sections.join(", ")}`
  );
} catch (error) {
  console.error(`forma-sync-sections: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
