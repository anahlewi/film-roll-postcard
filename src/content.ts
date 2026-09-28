import type { Roll } from "./types";

/** The sample roll behind /demo — for working on the strip without the API. */
const seedImages: Record<number, { url: string; width: number; height: number }> = {
  1: {
    url: "https://cdn.cosmos.so/51215b46-aa0d-4026-9180-18e93cfa619c",
    width: 2000,
    height: 1326,
  },
  2: {
    url: "https://tyajqainwjvxmehbptzh.supabase.co/storage/v1/object/public/media/webcam-example.gif",
    width: 3024,
    height: 1718,
  },
  3: {
    url: "https://tyajqainwjvxmehbptzh.supabase.co/storage/v1/object/public/media/webcam-example.gif",
    width: 3024,
    height: 1718,
  },
  4: {
    url: "https://tyajqainwjvxmehbptzh.supabase.co/storage/v1/object/public/media/webcam-example.gif",
    width: 3024,
    height: 1718,
  },
  5: {
    url: "https://tyajqainwjvxmehbptzh.supabase.co/storage/v1/object/public/media/webcam-example.gif",
    width: 3024,
    height: 1718,
  },
};

function seedRoll(): Roll {
  return {
    number: 24,
    title: "Prototype roll",
    stock: "OKROMA 100",
    frames: Array.from({ length: 24 }, (_, i) => ({
      id: `seed-${i + 1}`,
      code: String(i + 1),
      alt: `Frame ${i + 1} — placeholder, no image yet`,
      exposure: "f/2 · 1/125 · ISO 400",
      ...(seedImages[i + 1] ? { image: seedImages[i + 1] } : {}),
    })),
  };
}

export const roll: Roll = seedRoll();
