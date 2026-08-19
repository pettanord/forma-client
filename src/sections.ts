// Per-field section resolution: "the Forma value when set, else the site's
// own fallback". These are the helpers every site frontend layers over its
// static copy (the pn-org/echurch pilot pattern, forma-cms PRODUCT.md
// workstream 1) — shipped here so a new site gets them for free instead of
// copy-pasting them into lib/sections.ts.
//
// All pure and client-safe: they never fetch, they only resolve values a
// `getSections()` call already returned.

import type { SectionContent, TiptapNode } from "./types.js";

/** A text/url field when set to non-empty text in Forma, else the fallback. */
export function sText(
  section: SectionContent | null,
  key: string,
  fallback: string
): string {
  const value = section?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

/**
 * An image field: the Forma-picked URL when set, else the fallback (the
 * static asset in /public). Forma only stores http(s) URLs for image
 * fields, but check anyway — a broken value must fall back, never 404 the
 * image. Give the surrounding markup object-fit + a fixed aspect ratio so
 * any uploaded image renders inside the design's frame.
 */
export function sImage(
  section: SectionContent | null,
  key: string,
  fallback: string
): string {
  const value = section?.[key];
  return typeof value === "string" && /^https?:\/\//.test(value.trim())
    ? value.trim()
    : fallback;
}

/** A richtext field's Tiptap doc (render with <RichText>), or null when unset. */
export function sRich(
  section: SectionContent | null,
  key: string
): TiptapNode | null {
  const value = section?.[key];
  return typeof value === "object" && value !== null ? (value as TiptapNode) : null;
}

/**
 * A richtext field flattened to plain paragraph strings, or null when
 * unset — for designs that render paragraphs through their own component
 * (collapsing, columns) rather than as rich HTML.
 */
export function sParagraphs(
  section: SectionContent | null,
  key: string
): string[] | null {
  const doc = sRich(section, key);
  if (!doc) return null;
  const paragraphs: string[] = [];
  for (const node of doc.content ?? []) {
    if (node.type !== "paragraph") continue;
    const text = (node.content ?? [])
      .map((child) => (child.type === "text" ? child.text ?? "" : ""))
      .join("")
      .trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs.length > 0 ? paragraphs : null;
}
