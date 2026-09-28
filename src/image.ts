/**
 * Sanity's image CDN honours ?w= &fm= &q= &fit= on the bare asset URL, so we
 * build responsive candidates with plain string work — no runtime SDK needed.
 * Shared rolls live in Supabase Storage, already resized to ~1800px JPEG on
 * upload, so those URLs are served as-is.
 */
const WIDTHS = [320, 480, 640, 900, 1200, 1600] as const;

export const IMG_SIZES = "(max-width: 640px) 46vw, 200px";

const isSanity = (url: string) => url.includes("cdn.sanity.io");

export function buildSrcSet(url: string | undefined): string | undefined {
  if (!url || !isSanity(url)) return undefined;
  return WIDTHS.map((w) => `${transform(url, w)} ${w}w`).join(", ");
}

export function transform(url: string, w: number): string {
  if (!isSanity(url)) return url;
  return `${url}?w=${w}&fm=avif&q=70&fit=crop&auto=format`;
}
