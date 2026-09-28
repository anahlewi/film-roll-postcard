import { defineType, defineField } from "sanity";

export default defineType({
  name: "roll",
  title: "Roll",
  type: "document",
  fields: [
    defineField({
      name: "number",
      title: "Roll number",
      type: "number",
      validation: (r) => r.required().integer().positive(),
    }),
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({
      name: "stock",
      title: "Film stock",
      type: "string",
      description: "Printed along the lower rebate.",
      initialValue: "OKROMA 100",
    }),
    defineField({
      name: "frames",
      title: "Frames",
      type: "array",
      of: [{ type: "frame" }],
      validation: (r) => r.min(1).max(40),
    }),
  ],
  preview: {
    select: { title: "title", number: "number", frames: "frames" },
    prepare: ({ title, number, frames }) => ({
      title: title || `Roll ${number ?? "?"}`,
      subtitle: `${frames?.length ?? 0} frames`,
    }),
  },
});
