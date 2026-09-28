import type { Roll } from "./types";

/** Thin client for the /api functions. Errors surface the server's message. */

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  // plain `vite` has no /api and answers with index.html — don't mistake that for data
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The darkroom's offline — run `npm run dev:full` for the API");
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export interface Started {
  slug: string;
  deleteToken: string;
  uploads: { path: string; signedUrl: string }[];
}

export const startRoll = (data: { recipient: string; sender?: string; note?: string; count: number }) =>
  call<Started>("/api/rolls", { method: "POST", body: JSON.stringify(data) });

export const publishRoll = (
  slug: string,
  token: string,
  frames: { path: string; width: number; height: number; alt?: string }[],
) =>
  call<{ slug: string }>(`/api/rolls/${slug}/publish`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ frames }),
  });

export const getRoll = (slug: string) => call<Roll>(`/api/rolls/${slug}`);

export const deleteRoll = (slug: string, token: string) =>
  call<{ deleted: boolean }>(`/api/rolls/${slug}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });

/**
 * PUT straight to Supabase Storage via the signed URL — never through Vercel.
 * max-age is an hour, not a year: when a sender takes a roll back, the CDN
 * copies should stop serving soon after.
 */
export async function upload(signedUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg", "cache-control": "max-age=3600", "x-upsert": "false" },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}
