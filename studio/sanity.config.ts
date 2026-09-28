import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";

/**
 * Set SANITY_STUDIO_PROJECT_ID in studio/.env (see .env.example), or run
 * `npx sanity init` in this folder to create a project and wire it up.
 */
export default defineConfig({
  name: "roll-24",
  title: "Roll 24",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "REPLACE_ME",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
