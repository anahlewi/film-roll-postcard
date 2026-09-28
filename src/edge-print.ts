import type { Frame, Roll } from "./types";

/**
 * The Kodak-style rebate markings, derived from frame metadata rather than
 * hand-drawn: half-frame tick, barcode block, ISO, maker text, direction arrow.
 * The interactive frame-number <button> is created by FilmStrip and prepended
 * to the row returned here.
 */

function span(cls: string, text: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = cls;
  s.textContent = text;
  s.setAttribute("aria-hidden", "true");
  return s;
}

function isoFrom(exposure: string | undefined): string {
  const m = exposure?.match(/ISO\s*(\d+)/i);
  return m ? m[1] : "100";
}

/** decorative siblings that sit after the number button on the top rebate */
export function edgeTopDecor(frame: Frame): HTMLSpanElement[] {
  return [
    span("numA", `${frame.code}A`),
    span("barcode", ""),
    span("iso", isoFrom(frame.exposure)),
  ];
}

/** the full lower rebate row */
export function edgeBottom(frame: Frame, roll: Roll): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "edge edge-bot";
  row.setAttribute("aria-hidden", "true");
  row.append(
    span("dashes", ""),
    span("maker", roll.stock),
    span("arrow", `→ ${frame.code}A`),
  );
  return row;
}
