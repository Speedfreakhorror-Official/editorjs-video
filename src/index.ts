// editorjs-video: a video block for Editor.js (YouTube, Vimeo, host providers, title, poster).
import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { el, imageField, isError, normalizeImage, type ImageConfig, type ToolImage } from './image';

export type { ImageConfig, ToolImage } from './image';
export interface VideoData { provider: string; id: string; title: string; poster?: ToolImage }
export interface Provider { name: string; label: string; parse(text: string): string | null; embed(id: string): string }
export interface VideoConfig {
  providers?: Provider[];
  upload?: (file: File, onProgress: (fraction: number) => void) => Promise<{ provider: string; id: string } | { error: string }>;
  uploader?: ImageConfig['uploader'];
  /** More ways to pick the poster, and actions on it (as the picture tool's). */
  sources?: ImageConfig['sources'];
  actions?: ImageConfig['actions'];
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;

function url(text: string): URL | null {
  try { return new URL(text.trim()); } catch { return null; }
}

export const BUILT_IN: Provider[] = [
  {
    name: 'youtube', label: 'YouTube',
    parse(text) {
      const u = url(text);
      if (!u || !/^https?:$/.test(u.protocol)) return null;
      const host = u.hostname.replace(/^(www|m)\./, '');
      let id: string | null = null;
      if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
      else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        const [, kind, rest] = u.pathname.split('/');
        if (kind === 'watch') id = u.searchParams.get('v');
        else if (kind === 'shorts' || kind === 'embed' || kind === 'live') id = rest ?? null;
      }
      return id && YT_ID.test(id) ? id : null;
    },
    embed: (id) => `https://www.youtube.com/embed/${id}`,
  },
  {
    name: 'vimeo', label: 'Vimeo',
    parse(text) {
      const u = url(text);
      if (!u || !/^https?:$/.test(u.protocol)) return null;
      const host = u.hostname.replace(/^www\./, '');
      const parts = u.pathname.split('/').filter(Boolean);
      const id = host === 'vimeo.com' ? parts[0] : host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : undefined;
      return id && VIMEO_ID.test(id) ? id : null;
    },
    embed: (id) => `https://player.vimeo.com/video/${id}`,
  },
];

/** The first provider that reads the text as a video link or id. */
export function parseLink(text: string, providers: Pick<Provider, 'name' | 'parse'>[]): { provider: string; id: string } | null {
  const t = text.trim();
  if (!t) return null;
  for (const p of providers) {
    const id = p.parse(t);
    if (id) return { provider: p.name, id };
  }
  return null;
}

/** Whether the block shows an upload button. */
export const uploadVisible = (config: VideoConfig) => typeof config.upload === 'function';

/** Fills defaults and drops unknown top-level keys. */
export function normalize(data: unknown): VideoData {
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const poster = normalizeImage(o.poster);
  return { provider: str(o.provider), id: str(o.id), title: str(o.title), ...(poster ? { poster } : {}) };
}

/** True when a video is picked and has a title. */
export const isValid = (d: VideoData) => !!d.provider && !!d.id && d.title.trim() !== '';
/** True when nothing is set: no video, title or poster (the only block `validate` refuses). */
export const isEmpty = (d: VideoData) => !d.provider && !d.id && !d.title.trim() && !d.poster;

export default class VideoTool implements BlockTool {
  private data: VideoData;
  private root = el('div', 'ejs-video');
  constructor(private opts: BlockToolConstructorOptions<VideoData, VideoConfig>) {
    this.data = normalize(opts.data);
  }
  static get toolbox() {
    return { title: 'Video', icon: '<svg width="17" height="15" viewBox="0 0 17 15"><rect x="1" y="2" width="15" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 5.5l4 2-4 2z" fill="currentColor"/></svg>' };
  }
  static get isReadOnlySupported() { return true; }

  render(): HTMLElement {
    // typing in an input changes no DOM node, so Editor.js is told
    this.root.addEventListener('input', () => this.opts.block.dispatchChange());
    this.draw();
    return this.root;
  }
  save(): VideoData { return this.data; }
  // Editor.js drops a block that fails validate from the save: only an empty one, so a half-made one reaches the host
  validate(data: VideoData) { return !isEmpty(normalize(data)); }

  private get config(): VideoConfig { return this.opts.config ?? {}; }
  private get providers() { return [...BUILT_IN, ...(this.config.providers ?? [])]; }

  private draw() {
    const d = this.data;
    const ro = (this.opts.api as API).readOnly.isEnabled;
    this.root.replaceChildren();
    // preview: the poster or a plain play box, never a frame
    const box = el('div', 'ejs-video-box');
    if (d.poster) { const p = el('img', 'ejs-video-poster'); p.src = d.poster.url; p.alt = d.poster.alt; box.append(p); }
    box.append(el('div', 'ejs-video-play', '▶'));
    this.root.append(box);

    const status = el('div', 'ejs-video-status');
    const showStatus = () => {
      const p = this.providers.find((x) => x.name === this.data.provider);
      status.textContent = this.data.id ? `${p?.label ?? this.data.provider}: ${this.data.id}` : 'Paste a video link';
    };
    showStatus();
    const err = el('div', 'ejs-video-error');
    err.setAttribute('role', 'alert');

    if (!ro) {
      const link = el('input', 'ejs-video-input');
      link.type = 'text';
      link.placeholder = 'Paste a YouTube or Vimeo link';
      link.oninput = () => {
        const hit = parseLink(link.value, this.providers);
        err.textContent = link.value.trim() && !hit ? 'That is not a link this block can show.' : '';
        if (hit) { this.data = { ...this.data, ...hit }; showStatus(); }
      };
      this.root.append(link);
      if (uploadVisible(this.config)) this.root.append(this.uploadBar(showStatus, err));
    }
    this.root.append(status);

    const title = el('input', 'ejs-video-input');
    title.type = 'text';
    title.placeholder = 'Title (required)';
    title.value = d.title;
    title.disabled = ro;
    title.required = true;
    title.setAttribute('aria-invalid', String(!d.title.trim()));
    title.oninput = () => { this.data.title = title.value; title.setAttribute('aria-invalid', String(!title.value.trim())); };
    this.root.append(title);

    this.root.append(el('div', 'ejs-video-label', 'Poster (optional)'));
    this.root.append(imageField({
      value: d.poster ?? null, config: { uploader: this.config.uploader, sources: this.config.sources, actions: this.config.actions }, api: this.opts.api as API,
      onChange: (v) => { const { poster: _p, ...rest } = this.data; this.data = v ? { ...rest, poster: v } : rest; },
    }));
    this.root.append(err);
  }

  private uploadBar(showStatus: () => void, err: HTMLElement) {
    const bar = el('div', 'ejs-video-bar');
    const file = el('input', 'ejs-video-file');
    file.type = 'file';
    file.accept = 'video/*';
    file.hidden = true;
    const btn = el('button', 'ejs-video-btn', 'Upload a video');
    btn.type = 'button';
    btn.onclick = () => file.click();
    const progress = el('span', 'ejs-video-progress');
    file.onchange = async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f || !this.config.upload) return;
      btn.disabled = true;
      err.textContent = '';
      try {
        const r = await this.config.upload(f, (x) => { progress.textContent = `${Math.round(x * 100)}%`; });
        if (isError(r)) err.textContent = r.error;
        else { this.data = { ...this.data, provider: r.provider, id: r.id }; showStatus(); }
      } catch (e) { err.textContent = e instanceof Error ? e.message : 'The upload failed.'; }
      progress.textContent = '';
      btn.disabled = false;
    };
    bar.append(file, btn, progress);
    return bar;
  }
}
