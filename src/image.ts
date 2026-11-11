// The picture-with-description widget the block tools share: upload, host sources and actions, required alt text.
import type { API } from '@editorjs/editorjs';

export interface ToolImage { url: string; width: number; height: number; alt: string; [extra: string]: unknown }
/** A picture before its description is written (Omit<> would lose the named keys behind the index signature). */
export interface BareImage { url: string; width: number; height: number; [extra: string]: unknown }
export interface ImageConfig {
  uploader?: (file: File) => Promise<BareImage | { error: string }>;
  sources?: { label: string; icon?: string; pick: () => Promise<(BareImage & { alt?: string }) | null> }[];
  actions?: { label: string; show: (img: ToolImage) => boolean; run: (img: ToolImage) => Promise<ToolImage | { error: string }> }[];
}

const P = 'ejs-video';

/** An `{ error }` answer from a host callback (the index signature stops `in` from narrowing). */
export const isError = (r: object): r is { error: string } => typeof (r as { error?: unknown }).error === 'string';

/** A saved image as a ToolImage (extras kept), or null when it is not one. */
export function normalizeImage(v: unknown): ToolImage | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.url !== 'string' || !o.url || typeof o.width !== 'number' || typeof o.height !== 'number') return null;
  return { ...o, url: o.url, width: o.width, height: o.height, alt: typeof o.alt === 'string' ? o.alt : '' };
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function imageField(opts: { value: ToolImage | null; config: ImageConfig; api: API; onChange(v: ToolImage | null): void }): HTMLElement {
  const { config, api, onChange } = opts;
  let img = opts.value;
  const root = el('div', `${P}-field`);
  const note = el('div', `${P}-error`);
  note.setAttribute('role', 'alert');
  const fail = (m: string) => { note.textContent = m; };
  const set = (v: ToolImage | null) => { img = v; onChange(v); draw(); };
  const run = async (btn: HTMLButtonElement, job: () => Promise<void>) => {
    btn.disabled = true;
    try { await job(); } catch (e) { fail(e instanceof Error ? e.message : 'Something went wrong.'); } finally { btn.disabled = false; }
  };
  const button = (label: string, onClick: (b: HTMLButtonElement) => void) => {
    const b = el('button', `${P}-btn`, label);
    b.type = 'button';
    b.onclick = () => onClick(b);
    return b;
  };

  function draw() {
    root.replaceChildren();
    if (img) {
      const pic = el('img', `${P}-img`);
      pic.src = img.url;
      pic.alt = img.alt;
      root.append(pic);
    } else root.append(el('div', `${P}-empty`, 'No picture yet'));
    const bar = el('div', `${P}-bar`);
    if (!api.readOnly.isEnabled) {
      if (config.uploader) {
        const up = config.uploader;
        const file = el('input', `${P}-file`);
        file.type = 'file';
        file.accept = 'image/*';
        file.hidden = true;
        file.onchange = () => {
          const f = file.files?.[0];
          file.value = '';
          if (f) void run(pick, async () => {
            const r = await up(f);
            if (isError(r)) return fail(r.error);
            set({ ...r, alt: img?.alt ?? '' });
          });
        };
        const pick = button(img ? 'Replace picture' : 'Upload picture', () => file.click());
        bar.append(file, pick);
      }
      for (const s of config.sources ?? []) {
        bar.append(button(s.label, (b) => void run(b, async () => {
          const r = await s.pick();
          if (r) set({ ...r, alt: r.alt ?? img?.alt ?? '' });
        })));
      }
      if (img) {
        for (const a of config.actions ?? []) {
          if (!a.show(img)) continue;
          bar.append(button(a.label, (b) => void run(b, async () => {
            const r = await a.run(img!);
            if (isError(r)) return fail(r.error);
            set(r);
          })));
        }
        bar.append(button('Remove', () => set(null)));
      }
    }
    root.append(bar);
    if (img) {
      const label = el('label', `${P}-label`, 'Description (alt text, required)');
      const alt = el('input', `${P}-input`);
      alt.type = 'text';
      alt.value = img.alt;
      alt.required = true;
      alt.disabled = api.readOnly.isEnabled;
      alt.setAttribute('aria-invalid', String(!img.alt.trim()));
      alt.oninput = () => {
        img = { ...img!, alt: alt.value };
        alt.setAttribute('aria-invalid', String(!alt.value.trim()));
        onChange(img);
      };
      label.append(alt);
      root.append(label);
    }
    root.append(note);
  }
  draw();
  return root;
}
