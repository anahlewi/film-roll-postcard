/**
 * End-to-end check against the real Supabase project, no Vercel needed:
 * create → upload (signed URL) → publish → get → image fetch → delete → 404.
 *
 *   npx tsx --env-file=.env scripts/smoke-test.ts
 *
 * Leaves nothing behind unless a step fails midway.
 */
import { POST as create } from "../api/rolls/index.js";
import { GET as get, DELETE as del } from "../api/rolls/[slug]/index.js";
import { POST as publish } from "../api/rolls/[slug]/publish.js";
import { BUCKET, db } from "../api/_lib/server.js";

const BASE = "http://localhost/api/rolls";
// smallest valid JPEG (1×1 white)
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z",
  "base64",
);

const step = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exit(1);
};

const req = (url: string, init: RequestInit = {}) =>
  new Request(url, { ...init, headers: { "content-type": "application/json", ...init.headers } });

// 1. create
const r1 = await create(req(BASE, { method: "POST", body: JSON.stringify({ recipient: "Smoke Test", sender: "Claude", note: "hello", count: 2 }) }));
const started = await r1.json();
step("create", r1.status === 201, r1.status === 201 ? `slug ${started.slug}` : JSON.stringify(started));

// 2. upload both frames straight to storage, exactly like the browser does
for (const [i, u] of started.uploads.entries()) {
  const res = await fetch(u.signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg", "cache-control": "max-age=3600", "x-upsert": "false" },
    body: JPEG,
  });
  step(`upload frame ${i + 1} (no apikey header)`, res.ok, res.ok ? "" : `${res.status} ${await res.text()}`);
}

const auth = { authorization: `Bearer ${started.deleteToken}` };

// 3. publish — also try a forged path, which must be dropped
const frames = started.uploads.map((u: { path: string }) => ({ path: u.path, width: 1, height: 1 }));
frames.push({ path: "someone-else/01-evil.jpg", width: 1, height: 1 });
const r3 = await publish(req(`${BASE}/${started.slug}/publish`, { method: "POST", headers: auth, body: JSON.stringify({ frames }) }));
const pub = await r3.json();
step("publish", r3.ok && pub.frames === 2, JSON.stringify(pub));

// 4. wrong token can't publish or delete
const r4 = await del(req(`${BASE}/${started.slug}`, { method: "DELETE", headers: { authorization: "Bearer nope" } }));
step("wrong token rejected", r4.status === 404);

// 5. read it back as the recipient
const r5 = await get(req(`${BASE}/${started.slug}`));
const roll = await r5.json();
step("get", r5.ok && roll.frames.length === 2 && roll.to === "Smoke Test", `${roll.frames?.length} frames, to ${roll.to}`);

// 6. the public image URL actually serves
const img = await fetch(roll.frames[0].image.url);
step("image is public", img.ok && img.headers.get("content-type") === "image/jpeg", `${img.status} ${img.headers.get("content-type")}`);

// 7. take it back
const r7 = await del(req(`${BASE}/${started.slug}`, { method: "DELETE", headers: auth }));
step("delete", r7.ok);

const r8 = await get(req(`${BASE}/${started.slug}`));
step("gone after delete", r8.status === 404);
// check storage itself — the public URL can stay CDN-cached for up to max-age
const folder = roll.frames[0].id.split("/")[0];
const { data: left } = await db().storage.from(BUCKET).list(folder);
step("files removed from storage", (left ?? []).length === 0, `${left?.length ?? 0} left`);

console.log("\nAll good — the darkroom works.");
