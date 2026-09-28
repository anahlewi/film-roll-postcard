import { deleteRoll, getRoll } from "./api";
import { playShutter } from "./audio";
import { FilmStrip } from "./film-strip";
import type { Roll } from "./types";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * `/r/<slug>` — the recipient's side. A sealed canister first ("a roll for
 * Maya — open"), which doubles as the user gesture that unlocks Web Audio;
 * then the strip. `#delete=<token>` turns the page into the take-back screen.
 */
export async function mountViewer(mount: HTMLElement, slug: string): Promise<void> {
  const del = location.hash.match(/delete=([\w-]+)/)?.[1];
  if (del) return mountTakeBack(mount, slug, del);

  mount.className = "page page-view";
  mount.innerHTML = `<p class="loading" role="status">Loading the roll…</p>`;

  let roll: Roll;
  try {
    roll = await getRoll(slug);
  } catch (e) {
    mount.innerHTML = `
      <div class="canister">
        <p class="can-kicker">No roll here</p>
        <p class="can-sub">${esc((e as Error).message)}</p>
        <a class="btn" href="/">Make a roll</a>
      </div>`;
    return;
  }

  document.title = `A roll for ${roll.to ?? "you"} — Roll 24`;
  mountRoll(mount, roll);
}

/** also used by /demo with the seed roll */
export function mountRoll(mount: HTMLElement, roll: Roll): void {
  mount.className = "page page-view";
  const to = roll.to ? esc(roll.to) : "you";
  mount.innerHTML = `
    <div class="canister">
      <p class="can-kicker">A roll for</p>
      <h1 class="can-to">${to}</h1>
      ${roll.from ? `<p class="can-sub">from ${esc(roll.from)} · ${roll.frames.length} exposures</p>` : `<p class="can-sub">${roll.frames.length} exposures</p>`}
      <button class="btn btn-primary" type="button">Open</button>
    </div>
  `;

  const open = mount.querySelector<HTMLButtonElement>(".canister button")!;
  open.focus();
  open.addEventListener("click", () => {
    playShutter();
    mount.innerHTML = `
      <p class="roll-to" aria-hidden="true">For ${to}</p>
      <div class="stage"></div>
      ${roll.note ? `<blockquote class="roll-note"><p>${esc(roll.note)}</p>${roll.from ? `<footer>— ${esc(roll.from)}</footer>` : ""}</blockquote>` : ""}
      <a class="make-own" href="/">Load a roll for someone →</a>
    `;
    new FilmStrip(mount.querySelector<HTMLElement>(".stage")!, roll);
    mount.querySelector<HTMLButtonElement>("button.num")?.focus();
  });
}

function mountTakeBack(mount: HTMLElement, slug: string, token: string): void {
  mount.className = "page page-view";
  mount.innerHTML = `
    <div class="canister">
      <p class="can-kicker">Take this roll back?</p>
      <p class="can-sub">The link stops working and the photos are deleted. This can't be undone.</p>
      <div class="done-actions">
        <button class="btn btn-danger" type="button" data-act="delete">Delete roll</button>
        <a class="btn" href="/r/${slug}">Keep it</a>
      </div>
      <p class="status" role="status" aria-live="polite"></p>
    </div>
  `;
  const btn = mount.querySelector<HTMLButtonElement>('[data-act="delete"]')!;
  const status = mount.querySelector<HTMLElement>(".status")!;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await deleteRoll(slug, token);
      history.replaceState(null, "", "/");
      mount.querySelector(".canister")!.innerHTML = `
        <p class="can-kicker">Taken back.</p>
        <p class="can-sub">That link no longer works.</p>
        <a class="btn" href="/">Make a roll</a>`;
    } catch (e) {
      btn.disabled = false;
      status.textContent = (e as Error).message;
      status.classList.add("is-error");
    }
  });
}
