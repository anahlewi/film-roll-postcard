/**
 * Shared bits for the /api functions. Files under an underscore folder are
 * not routes on Vercel.
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses RLS — it lives only here, server-side,
 * never behind a VITE_ prefix.
 */
import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "rolls";
export const MAX_FRAMES = 36;
export const LIMITS = { recipient: 40, sender: 40, note: 280, alt: 140 } as const;

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no l/1/o/0 — readable aloud

/** 10 chars from a 32-symbol alphabet = 50 bits: unguessable, still short */
export function makeSlug(len = 10): string {
  const bytes = randomBytes(len);
  let s = "";
  for (const b of bytes) s += ALPHABET[b & 31];
  return s;
}

export function makeToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

export const fail = (status: number, error: string) => json({ error }, status);

/** trimmed string capped at `max`, or undefined if empty */
export function clean(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s || undefined;
}

/** /api/rolls/<slug>[/...] → slug */
export function slugFrom(req: Request): string | undefined {
  const m = new URL(req.url).pathname.match(/\/api\/rolls\/([a-z0-9]{6,16})(?:\/|$)/);
  return m?.[1];
}

export function bearer(req: Request): string | undefined {
  return req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
}

export function publicUrl(path: string): string {
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
