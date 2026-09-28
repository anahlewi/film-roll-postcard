/**
 * Bakes one roll from Sanity into src/content.generated.json, which
 * src/content.ts picks up. Runs in `prebuild` and via `npm run content`.
 *
 *   SANITY_PROJECT_ID=xxxx SANITY_DATASET=production ROLL=24 npm run content
 *
 * With no SANITY_PROJECT_ID it exits 0 and the app falls back to the seed roll.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";

const projectId = process.env.SANITY_PROJECT_ID;
if (!projectId) {
  console.warn("[content] SANITY_PROJECT_ID not set — skipping, app will use the seed roll.");
  process.exit(0);
}

const client = createClient({
  projectId,
  dataset: process.env.SANITY_DATASET ?? "production",
  apiVersion: "2024-01-01",
  useCdn: true,
});

const rollNumber = Number(process.env.ROLL ?? 24);

const QUERY = /* groq */ `
*[_type == "roll" && number == $number][0]{
  number,
  title,
  "stock": coalesce(stock, "OKROMA 100"),
  "frames": frames[]{
    "id": _key,
    "code": coalesce(code, string(^.number)),
    "alt": coalesce(alt, "Untitled frame"),
    caption,
    exposure,
    shotAt,
    "image": image.asset->{
      "url": url,
      "width": metadata.dimensions.width,
      "height": metadata.dimensions.height,
      "lqip": metadata.lqip
    }
  }
}`;

const roll = await client.fetch(QUERY, { number: rollNumber });

if (!roll) {
  console.error(`[content] No roll with number ${rollNumber} found in Sanity.`);
  process.exit(1);
}

const out = fileURLToPath(new URL("../src/content.generated.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(roll, null, 2)}\n`);
console.log(`[content] Baked roll #${roll.number} — ${roll.frames?.length ?? 0} frames → ${out}`);
