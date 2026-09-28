/**
 * GET    /api/rolls/<slug> — the public roll, shaped for the FilmStrip
 * DELETE /api/rolls/<slug> — sender takes it down (Bearer <deleteToken>)
 */
import type { Roll } from "../../../src/types.js";
import { BUCKET, bearer, db, fail, handler, hashToken, json, publicUrl, slugFrom } from "../../_lib/server.js";

interface StoredFrame {
  path: string;
  width: number;
  height: number;
  alt?: string;
}

export const GET = handler(async (req: Request): Promise<Response> => {
  const slug = slugFrom(req);
  if (!slug) return fail(404, "No such roll");

  const { data } = await db()
    .from("rolls")
    .select("recipient, sender, note, stock, frames, expires_at")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();

  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) {
    return fail(404, "This roll doesn't exist, or it's been taken back");
  }

  const frames = data.frames as StoredFrame[];
  const roll: Roll = {
    number: frames.length,
    title: `For ${data.recipient}`,
    stock: data.stock,
    to: data.recipient,
    from: data.sender ?? undefined,
    note: data.note ?? undefined,
    frames: frames.map((f, i) => ({
      id: f.path,
      code: String(i + 1),
      alt: f.alt ?? `Frame ${i + 1}`,
      image: { url: publicUrl(f.path), width: f.width, height: f.height },
    })),
  };

  // short edge cache: a deleted roll disappears within a minute
  return json(roll, 200, { "cache-control": "public, max-age=0, s-maxage=60" });
});

export const DELETE = handler(async (req: Request): Promise<Response> => {
  const slug = slugFrom(req);
  const token = bearer(req);
  if (!slug || !token) return fail(400, "Missing roll or token");

  const { data: roll } = await db()
    .from("rolls")
    .select("id, delete_token_hash")
    .eq("slug", slug)
    .maybeSingle();
  if (!roll || roll.delete_token_hash !== hashToken(token)) return fail(404, "No such roll");

  const storage = db().storage.from(BUCKET);
  const { data: objects } = await storage.list(roll.id, { limit: 100 });
  if (objects?.length) await storage.remove(objects.map((o) => `${roll.id}/${o.name}`));
  await db().from("rolls").delete().eq("id", roll.id);

  return json({ deleted: true });
});
