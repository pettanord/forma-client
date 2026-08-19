# @forma/client

The shared layer every Forma site frontend is built on. One package, four
jobs — so a bug fixed here is fixed for every church at their next
`npm update`, and a new site starts at "wire the design" instead of
"re-implement the plumbing".

Forma CMS (`forma-cms`) is the backend; this package never sees a service
role key. Reads use the Supabase **anon** key (RLS limits it to published
content by design), writes go through the Forma admin's `/api/*` endpoints.

## Install

Not on npm. Consume it from the repo:

```jsonc
// package.json in a site frontend
"dependencies": {
  "@forma/client": "github:pettanord/forma-client"
  // or during local development:
  // "@forma/client": "file:../forma-client"
}
```

## 1. Typed content queries

```ts
// lib/forma.ts in the site frontend
import { createForma } from "@forma/client";

export const forma = createForma({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  siteId: process.env.NEXT_PUBLIC_FORMA_SITE_ID!,
  formaApiUrl: process.env.NEXT_PUBLIC_FORMA_API_URL!, // https://formacms.se
});
```

```ts
const news = await forma.getPosts({ type: "news", locale: "sv", limit: 6 });
const post = await forma.getPost(slug);
const slides = await forma.getCarousel();               // "homepage-hero"
const courses = await forma.getCourses({ locale: "sv" });
const theme = await forma.getTheme();
const contact = await forma.getSection("contact-info"); // null until set
const many = await forma.getSections(["contact-info", "service-times"]);

// Writes always go through Forma's API, never straight to the database:
await forma.api("/api/contact", { email, message });
```

Every query is filtered on `siteId` inside the package — the shared
database holds other sites' content too, and that filter is not optional.

Resolve section fields over your static copy with the bundled helpers —
"the Forma value when set, else the site's own fallback", per field:

```ts
import { sText, sImage, sRich, sParagraphs } from "@forma/client";

const hero = {
  title: sText(section, "title", copy.hero.title),
  photo: sImage(section, "photo", "/uploads/hero.jpg"), // http(s) or fallback
  body: sRich(section, "body"),                 // Tiptap doc or null
  paragraphs: sParagraphs(section, "body"),     // plain strings or null
};
```

The site renders identically until someone edits, and clearing a field in
Forma restores the original. For `sImage`, give the `<img>` frame
`object-fit: cover` + a fixed aspect ratio so any uploaded image sits in
the design.

## 2. Rendering richtext

Forma's editors store Tiptap JSON. Render it with the shared component
instead of re-implementing the walk per site:

```tsx
import { RichText, richTextToPlainText } from "@forma/client/rich-text";

<RichText content={post.body} className="prose" />;
const metaDescription = richTextToPlainText(post.body).slice(0, 160);
```

Unknown node types render their children as readable text — a Forma
upgrade must never leave a hole in a page that hasn't updated the package.

## 3. Declaring editable sections (build-time sync)

The frontend is the thing that knows which editable slots it renders, so
it declares them. Create `forma.sections.mjs` in the site repo:

```js
import { defineSections } from "@forma/client";

export default defineSections([
  {
    key: "home-hero",                 // becomes /pages/home-hero in Forma
    label: "Startsidans hero",
    previewPath: "/",
    fields: [
      { key: "heading", label: "Rubrik", type: "text",
        hint: "Den stora raden överst." },
      { key: "image", label: "Bakgrundsbild", type: "image" },
    ],
  },
]);
```

Wire the sync as a build step and add the env:

```jsonc
// package.json
"scripts": { "postbuild": "forma-sync-sections" }
```

```
NEXT_PUBLIC_FORMA_API_URL=https://formacms.se
NEXT_PUBLIC_FORMA_SITE_ID=<site id>
FORMA_SCHEMA_SYNC_SECRET=<Settings → Integrations → Schema sync secret>
```

Add a `<Section>` slot to the template, deploy, and the field appears in
the customer's Forma admin by itself. No secret in the env = the sync
skips with a warning (local builds don't need production credentials); a
configured sync that fails **fails the build** — a slot that silently
never registers is a slot nobody can edit.

Sections removed from the manifest are flagged as orphaned in Forma,
never deleted — the customer's written content survives refactors.

Each section may declare `page: "Om oss"` (the display name of the page
it sits on — Forma groups /pages by it) and `locale: "sv"` (the language
of its copy — a bilingual site declares one section per locale, and Forma
turns the tags into language tabs). Both optional: without them the
section lists flat, like before the fields existed.

## 4. Receiving revalidation

When an editor saves in Forma, Forma POSTs to the site so the change shows
immediately instead of after the next cache expiry:

```ts
// app/api/revalidate/route.ts
import { createRevalidateHandler } from "@forma/client/revalidate";

export const POST = createRevalidateHandler({
  secret: process.env.FORMA_REVALIDATE_SECRET!, // Settings → Integrations
  paths: { post: ["/nyheter"] },                // optional per-kind extras
});
```

The layout root always revalidates; `paths` adds precision per kind
(`post`, `page-section`, `theme`, `carousel`, `course`, `product`).

## The rule that makes self-service real

When building a site on this package: **no copy and no image goes into
JSX except structural chrome** (nav labels, footer legal text). Everything
else renders through a section or a content query. A slot skipped here is
a slot the customer emails about for the next three years.

## Contracts this package pins

- Section manifest shape ⇄ `forma-cms/lib/page-sections/schema.ts`
- Revalidation POST shape ⇄ `forma-cms/lib/revalidate.ts`
- Content columns ⇄ `forma-cms/schema.sql`

A change on either side of any of these updates both repos in one breath.
