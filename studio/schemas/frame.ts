import { defineType, defineField } from "sanity";

export default defineType({
  name: "frame",
  title: "Frame",
  type: "object",
  fields: [
    defineField({
      name: "image",
      title: "Photograph",
      type: "image",
      options: { hotspot: true },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "alt",
      title: "Alt text",
      type: "string",
      description: "Described for screen readers. Required.",
      validation: (r) => r.required().min(4),
    }),
    defineField({ name: "caption", title: "Caption", type: "string" }),
    defineField({
      name: "code",
      title: "Edge number",
      type: "string",
      description: 'Printed on the rebate, e.g. "24" or "24A". Defaults to the roll number.',
    }),
    defineField({ name: "shotAt", title: "Shot at", type: "datetime" }),
    defineField({
      name: "exposure",
      title: "Exposure",
      type: "string",
      description: 'Free text — e.g. "f/2 · 1/125 · ISO 400". The ISO feeds the edge markings.',
    }),
  ],
  preview: {
    select: { media: "image", title: "caption", subtitle: "code" },
    prepare: ({ media, title, subtitle }) => ({
      media,
      title: title || "Untitled frame",
      subtitle: subtitle ? `Frame ${subtitle}` : undefined,
    }),
  },
});
