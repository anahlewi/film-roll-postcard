/**
 * POST /api/rolls/<slug>/publish — flip a pending roll live.
 *   header: Authorization: Bearer <deleteToken>
 *   body:   { frames: [{ path, width, height, alt? }] }   (in display order)
 *
 * Only paths issued at create time AND actually present in storage are kept,
 * so a client can't point a roll at someone else's files.
 */
import {
  BUCKET,
  LIMITS,
  bearer,
  clean,
  db,
  fail,
  handler,
  hashToken,
  json,
  slugFrom,
} from "../../_lib/server.js";

interface FrameIn {
  path?: unknown;
  width?: unknown;
  height?: unknown;
  alt?: unknown;
}

export const POST = handler(async (req: Request): Promise<Response> => {
  const slug = slugFrom(req);
  const token = bearer(req);
  if (!slug || !token) return fail(400, "Missing roll or token");

  const { data: roll } = await db()
    .from("rolls")
    .select("id, status, delete_token_hash, upload_paths")
    .eq("slug", slug)
    .maybeSingle();
  if (!roll || roll.delete_token_hash !== hashToken(token)) return fail(404, "No such roll");
  if (roll.status === "live") return json({ slug });

  let body: { frames?: FrameIn[] };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Bad JSON");
  }

  const { data: objects } = await db().storage.from(BUCKET).list(roll.id, { limit: 100 });
  const uploaded = new Set((objects ?? []).map((o) => `${roll.id}/${o.name}`));
  const issued = new Set<string>(roll.upload_paths);

  const frames = (body.frames ?? [])
    .filter((f): f is FrameIn & { path: string } => typeof f.path === "string")
    .filter((f) => issued.has(f.path) && uploaded.has(f.path))
    .map((f) => ({
      path: f.path,
      width: clampInt(f.width, 1, 10000, 1600),
      height: clampInt(f.height, 1, 10000, 1066),
      alt: clean(f.alt, LIMITS.alt),
    }));

  if (frames.length === 0) return fail(400, "Nothing on the roll made it up — try again");

  const { error } = await db()
    .from("rolls")
    .update({ frames, status: "live" })
    .eq("id", roll.id);
  if (error) {
    console.error("[publish]", error);
    return fail(500, "Couldn't develop the roll");
  }

  return json({ slug, frames: frames.length });
});

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
}
