/**
 * Shrink a photo in the browser before it ever leaves the device.
 * Re-encoding through a canvas drops every EXIF tag — GPS included — which
 * is the point: a roll sent to someone shouldn't carry where it was shot.
 */
const MAX_EDGE = 1800;
const QUALITY = 0.82;

export interface Developed {
  blob: Blob;
  width: number;
  height: number;
}

export async function develop(file: File): Promise<Developed> {
  let bitmap: ImageBitmap;
  try {
    // honours the EXIF orientation flag so portraits stay upright once it's stripped
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      /heic|heif/i.test(file.type || file.name)
        ? `${file.name}: this browser can't read HEIC — export it as JPEG`
        : `${file.name}: couldn't read this image`,
    );
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
  if (!blob) throw new Error(`${file.name}: couldn't encode`);
  return { blob, width, height };
}
