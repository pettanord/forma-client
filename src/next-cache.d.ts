// Minimal ambient declaration so the package compiles without depending on
// the full `next` package. At runtime the real next/cache is resolved from
// the consuming app, which is always a Next.js site.
declare module "next/cache" {
  export function revalidatePath(path: string, type?: "layout" | "page"): void;
}
