/**
 * POST /api/rolls — start a roll.
 *   body: { recipient, sender?, note?, count }
 *   → { slug, deleteToken, uploads: [{ path, signedUrl }] }
 *
 * The roll is created `pending`; the browser PUTs each (already resized,
 * EXIF-free) image to its signed URL, then calls /api/rolls/<slug>/publish.
 */
import { randomUUID } from "node:crypto";
import {
  BUCKET,
  LIMITS,
  MAX_FRAMES,
  clean,
  db,
  fail,
  hashToken,
  json,
  makeSlug,
  makeToken,
} from "../_lib/server.js";

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Bad JSON");
  }

  const recipient = clean(body.recipient, LIMITS.recipient);
  const sender = clean(body.sender, LIMITS.sender);
  const note = clean(body.note, LIMITS.note);
  const count = Number(body.count);

  if (!recipient) return fail(400, "Who is this roll for?");
  if (!Number.isInteger(count) || count < 1 || count > MAX_FRAMES) {
    return fail(400, `A roll holds 1–${MAX_FRAMES} frames`);
  }

  const id = randomUUID();
  const slug = makeSlug();
  const deleteToken = makeToken();
  const paths = Array.from({ length: count }, (_, i) => `${id}/${String(i + 1).padStart(2, "0")}-${makeSlug(6)}.jpg`);

  const { error } = await db().from("rolls").insert({
    id,
    slug,
    delete_token_hash: hashToken(deleteToken),
    recipient,
    sender,
    note,
    upload_paths: paths,
  });
  if (error) {
    console.error("[create]", error);
    return fail(500, "Couldn't load the film");
  }

  const storage = db().storage.from(BUCKET);
  const signed = await Promise.all(paths.map((p) => storage.createSignedUploadUrl(p)));
  const bad = signed.find((s) => s.error);
  if (bad?.error) {
    console.error("[create] sign", bad.error);
    await db().from("rolls").delete().eq("id", id);
    return fail(500, "Couldn't load the film");
  }

  return json(
    {
      slug,
      deleteToken,
      uploads: signed.map((s, i) => ({ path: paths[i], signedUrl: s.data!.signedUrl })),
    },
    201,
  );
}
