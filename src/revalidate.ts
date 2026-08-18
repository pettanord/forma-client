// The receiving half of Forma's revalidation hook (forma-cms
// lib/revalidate.ts is the sending half — the contract lives in both
// files and changes in both or not at all):
//
//   POST /api/revalidate
//   x-forma-secret: <site_integrations.revalidate_secret>
//   { "site_id": "...", "kind": "post" | "page-section" | "theme" |
//     "carousel" | "course" | "product", "key"?: "..." }
//
// Drop this in a site frontend as app/api/revalidate/route.ts:
//
//   import { createRevalidateHandler } from "@forma/client/revalidate";
//   export const POST = createRevalidateHandler({
//     secret: process.env.FORMA_REVALIDATE_SECRET!,
//   });

export type RevalidateKind =
  | "post"
  | "page-section"
  | "theme"
  | "carousel"
  | "course"
  | "product";

export interface RevalidateHandlerOptions {
  /** Must equal the site's revalidate_secret in Forma. */
  secret: string;
  /**
   * Paths to revalidate per kind, e.g. { post: ["/nyheter"] }. The layout
   * root always revalidates too — sections and theme can surface anywhere,
   * and a stale page that should have updated is the exact failure this
   * hook exists to prevent. Precision is an optimization here, not
   * correctness.
   */
  paths?: Partial<Record<RevalidateKind, string[]>>;
  /** Override for custom cache logic; defaults to next/cache revalidatePath. */
  revalidatePath?: (path: string, type?: "layout" | "page") => void;
}

export function createRevalidateHandler(options: RevalidateHandlerOptions) {
  if (!options.secret) {
    // Fail at build/boot, not at the first missed revalidation months later.
    throw new Error(
      "createRevalidateHandler: `secret` is empty — set FORMA_REVALIDATE_SECRET."
    );
  }

  return async function POST(request: Request): Promise<Response> {
    const provided = request.headers.get("x-forma-secret") ?? "";
    if (provided !== options.secret) {
      return Response.json({ error: "Bad or missing secret." }, { status: 401 });
    }

    let kind: RevalidateKind | undefined;
    try {
      const body = (await request.json()) as { kind?: RevalidateKind };
      kind = body.kind;
    } catch {
      // A body-less ping still revalidates the root — being generous here
      // costs one cache rebuild; being strict costs a stale site.
    }

    const revalidate =
      options.revalidatePath ??
      // Lazy so the module can load outside a Next request context (tests,
      // scripts) without exploding at import time.
      (await import("next/cache")).revalidatePath;

    const paths = new Set<string>(["/"]);
    for (const path of (kind && options.paths?.[kind]) ?? []) paths.add(path);
    for (const path of paths) revalidate(path, "layout");

    return Response.json({ revalidated: [...paths] });
  };
}
