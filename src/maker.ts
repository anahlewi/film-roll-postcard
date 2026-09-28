import { publishRoll, startRoll, upload } from "./api";
import { develop, type Developed } from "./process-image";
import { playShutter } from "./audio";

const MAX_FRAMES = 10;
const MINE_KEY = "roll24:mine";

interface Shot extends Developed {
  key: string;
  name: string;
  thumb: string;
}

/**
 * `/` — load a roll for someone. Photos are shrunk + EXIF-stripped on add,
 * shown as a contact sheet you can reorder, then uploaded straight to
 * Supabase Storage on "Develop".
 */
export function mountMaker(mount: HTMLElement): void {
  mount.className = "page page-make";
  mount.innerHTML = `
    <header class="mast">
      <h1 class="mast-title">Film Roll Postcard</h1>
      <p class="mast-sub">Load a film roll and share memories with your loved ones.</p>
    </header>

    <form class="make" novalidate>
      <div class="row">
        <label class="field">
          <span class="label">To</span>
          <input name="recipient" maxlength="40" autocomplete="off" required placeholder="Their name" />
        </label>
        <label class="field">
          <span class="label">From</span>
          <input name="sender" maxlength="40" autocomplete="off" placeholder="You (optional)" />
        </label>
      </div>

      <label class="field">
        <span class="label">Note <span class="count" data-count="note">0/280</span></span>
        <textarea name="note" maxlength="280" rows="3" placeholder="Tucked in the canister (optional)"></textarea>
      </label>

      <div class="field">
        <span class="label">Frames <span class="count" data-count="frames">0/${MAX_FRAMES}</span></span>
        <label class="drop">
          <input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple class="sr-only" />
          <span class="drop-cta">+ Add photos</span>
          <span class="drop-sub">or drop them here · ${MAX_FRAMES} max</span>
        </label>
        <ol class="sheet" aria-label="Contact sheet — frame order"></ol>
      </div>

      <button class="btn btn-primary" type="submit">Develop</button>
      <p class="status" role="status" aria-live="polite"></p>
    </form>

    <section class="done" hidden>
      <p class="done-kicker">Developed.</p>
      <h2 class="done-title" tabindex="-1"></h2>
      <div class="share">
        <input class="share-url" readonly aria-label="Link to the roll" />
        <button class="btn" type="button" data-act="copy">Copy</button>
        <button class="btn" type="button" data-act="share" hidden>Share</button>
      </div>
      <p class="fine">
        Only people with this link can see it.
        <a class="takeback" href="#">Take it back later</a> — this link deletes the roll; keep it private.
        It's also saved in this browser.
      </p>
      <div class="done-actions">
        <a class="btn" data-act="open" href="#">Open it</a>
        <button class="btn" type="button" data-act="again">Make another</button>
      </div>
    </section>
  `;

  const form = mount.querySelector<HTMLFormElement>("form.make")!;
  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]')!;
  const drop = form.querySelector<HTMLElement>(".drop")!;
  const sheet = form.querySelector<HTMLOListElement>(".sheet")!;
  const status = form.querySelector<HTMLElement>(".status")!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const note = form.querySelector<HTMLTextAreaElement>("textarea")!;
  const done = mount.querySelector<HTMLElement>(".done")!;

  let shots: Shot[] = [];
  let busy = false;

  const say = (msg: string, isError = false) => {
    status.textContent = msg;
    status.classList.toggle("is-error", isError);
  };

  note.addEventListener("input", () => {
    form.querySelector('[data-count="note"]')!.textContent = `${note.value.length}/280`;
  });

  /* ------------------------------------------------------------ adding */

  async function add(files: FileList | File[]) {
    const list = [...files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_FRAMES - shots.length;
    if (!list.length) return;
    if (room <= 0) return say(`The roll's full — ${MAX_FRAMES} frames max.`, true);

    const take = list.slice(0, room);
    const errors: string[] = [];
    for (const [i, file] of take.entries()) {
      say(`Loading ${i + 1}/${take.length}…`);
      try {
        const d = await develop(file);
        shots.push({ ...d, key: crypto.randomUUID(), name: file.name, thumb: URL.createObjectURL(d.blob) });
        drawSheet();
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (list.length > room) {
      errors.push(
        room === MAX_FRAMES
          ? `A roll holds ${MAX_FRAMES} photos — added the first ${MAX_FRAMES}.`
          : `Only room for ${room} more — the rest were left out.`,
      );
    }
    say(errors.join(" "), errors.length > 0);
  }

  fileInput.addEventListener("change", () => {
    if (fileInput.files) void add(fileInput.files);
    fileInput.value = "";
  });

  for (const ev of ["dragenter", "dragover"] as const) {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("is-over");
    });
  }
  for (const ev of ["dragleave", "drop"] as const) {
    drop.addEventListener(ev, () => drop.classList.remove("is-over"));
  }
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files) void add(e.dataTransfer.files);
  });

  /* ------------------------------------------------------ contact sheet */

  function drawSheet() {
    form.querySelector('[data-count="frames"]')!.textContent = `${shots.length}/${MAX_FRAMES}`;
    sheet.innerHTML = "";
    shots.forEach((s, i) => {
      const li = document.createElement("li");
      li.className = "cell";
      li.innerHTML = `
        <span class="cell-n">${i + 1}</span>
        <img alt="" src="${s.thumb}" />
        <span class="cell-tools">
          <button type="button" data-move="-1" aria-label="Move frame ${i + 1} earlier" ${i === 0 ? "disabled" : ""}>←</button>
          <button type="button" data-remove aria-label="Remove frame ${i + 1}">×</button>
          <button type="button" data-move="1" aria-label="Move frame ${i + 1} later" ${i === shots.length - 1 ? "disabled" : ""}>→</button>
        </span>
      `;
      li.dataset.i = String(i);
      sheet.appendChild(li);
    });
  }

  sheet.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    const li = btn?.closest<HTMLElement>(".cell");
    if (!btn || !li || busy) return;
    const i = Number(li.dataset.i);

    if (btn.hasAttribute("data-remove")) {
      URL.revokeObjectURL(shots[i].thumb);
      shots.splice(i, 1);
      drawSheet();
      sheet.querySelectorAll<HTMLButtonElement>("[data-remove]")[Math.min(i, shots.length - 1)]?.focus();
      return;
    }
    const j = i + Number(btn.dataset.move);
    if (j < 0 || j >= shots.length) return;
    [shots[i], shots[j]] = [shots[j], shots[i]];
    drawSheet();
    // keep focus on the same control, now on the moved frame
    sheet.querySelectorAll<HTMLButtonElement>(`[data-move="${btn.dataset.move}"]`)[j]?.focus();
  });

  /* ------------------------------------------------------------ develop */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const data = new FormData(form);
    const recipient = String(data.get("recipient") ?? "").trim();
    const sender = String(data.get("sender") ?? "").trim() || undefined;
    const noteText = String(data.get("note") ?? "").trim() || undefined;

    if (!recipient) {
      say("Who's it for?", true);
      form.querySelector<HTMLInputElement>('[name="recipient"]')!.focus();
      return;
    }
    if (!shots.length) return say("Add at least one photo.", true);

    busy = true;
    submit.disabled = true;
    form.classList.add("is-busy");

    try {
      say("Loading the film…");
      const started = await startRoll({ recipient, sender, note: noteText, count: shots.length });

      let sent = 0;
      say(`Developing 0/${shots.length}…`);
      await pool(shots, 4, async (s, i) => {
        await upload(started.uploads[i].signedUrl, s.blob);
        say(`Developing ${++sent}/${shots.length}…`);
      });

      await publishRoll(
        started.slug,
        started.deleteToken,
        shots.map((s, i) => ({ path: started.uploads[i].path, width: s.width, height: s.height, alt: `Frame ${i + 1}` })),
      );

      remember(started.slug, started.deleteToken, recipient);
      playShutter();
      showDone(started.slug, started.deleteToken, recipient);
    } catch (err) {
      say((err as Error).message || "Something went wrong — try again.", true);
    } finally {
      busy = false;
      submit.disabled = false;
      form.classList.remove("is-busy");
    }
  });

  function showDone(slug: string, token: string, recipient: string) {
    const url = `${location.origin}/r/${slug}`;
    form.hidden = true;
    done.hidden = false;
    done.querySelector(".done-title")!.textContent = `A roll for ${recipient}`;
    done.querySelector<HTMLInputElement>(".share-url")!.value = url;
    done.querySelector<HTMLAnchorElement>('[data-act="open"]')!.href = `/r/${slug}`;
    done.querySelector<HTMLAnchorElement>(".takeback")!.href = `/r/${slug}#delete=${token}`;

    const shareBtn = done.querySelector<HTMLButtonElement>('[data-act="share"]')!;
    shareBtn.hidden = !navigator.share;
    shareBtn.onclick = () => void navigator.share?.({ title: `A roll for ${recipient}`, url }).catch(() => {});

    const copyBtn = done.querySelector<HTMLButtonElement>('[data-act="copy"]')!;
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = "Copied";
      } catch {
        done.querySelector<HTMLInputElement>(".share-url")!.select();
      }
    };

    done.querySelector<HTMLButtonElement>('[data-act="again"]')!.onclick = () => {
      shots.forEach((s) => URL.revokeObjectURL(s.thumb));
      shots = [];
      form.reset();
      drawSheet();
      say("");
      copyBtn.textContent = "Copy";
      done.hidden = true;
      form.hidden = false;
    };

    done.querySelector<HTMLElement>(".done-title")!.focus();
  }

  drawSheet();
}

/** run `fn` over `items` with at most `n` in flight */
async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/** keep the take-back token in this browser too (never sent anywhere but our API) */
function remember(slug: string, token: string, to: string): void {
  try {
    const mine = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]");
    mine.unshift({ slug, token, to, at: new Date().toISOString() });
    localStorage.setItem(MINE_KEY, JSON.stringify(mine.slice(0, 50)));
  } catch {
    /* private mode — the take-back link on screen still works */
  }
}
