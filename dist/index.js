// src/image.ts
var P = "ejs-video";
var isError = (r) => typeof r.error === "string";
function normalizeImage(v) {
  if (!v || typeof v !== "object" || Array.isArray(v))
    return null;
  const o = v;
  if (typeof o.url !== "string" || !o.url || typeof o.width !== "number" || typeof o.height !== "number")
    return null;
  return { ...o, url: o.url, width: o.width, height: o.height, alt: typeof o.alt === "string" ? o.alt : "" };
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined)
    e.textContent = text;
  return e;
}
function imageField(opts) {
  const { config, api, onChange } = opts;
  let img = opts.value;
  const root = el("div", `${P}-field`);
  const note = el("div", `${P}-error`);
  note.setAttribute("role", "alert");
  const fail = (m) => {
    note.textContent = m;
  };
  const set = (v) => {
    img = v;
    onChange(v);
    draw();
  };
  const run = async (btn, job) => {
    btn.disabled = true;
    try {
      await job();
    } catch (e) {
      fail(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      btn.disabled = false;
    }
  };
  const button = (label, onClick) => {
    const b = el("button", `${P}-btn`, label);
    b.type = "button";
    b.onclick = () => onClick(b);
    return b;
  };
  function draw() {
    root.replaceChildren();
    if (img) {
      const pic = el("img", `${P}-img`);
      pic.src = img.url;
      pic.alt = img.alt;
      root.append(pic);
    } else
      root.append(el("div", `${P}-empty`, "No picture yet"));
    const bar = el("div", `${P}-bar`);
    if (!api.readOnly.isEnabled) {
      if (config.uploader) {
        const up = config.uploader;
        const file = el("input", `${P}-file`);
        file.type = "file";
        file.accept = "image/*";
        file.hidden = true;
        file.onchange = () => {
          const f = file.files?.[0];
          file.value = "";
          if (f)
            run(pick, async () => {
              const r = await up(f);
              if (isError(r))
                return fail(r.error);
              set({ ...r, alt: img?.alt ?? "" });
            });
        };
        const pick = button(img ? "Replace picture" : "Upload picture", () => file.click());
        bar.append(file, pick);
      }
      for (const s of config.sources ?? []) {
        bar.append(button(s.label, (b) => void run(b, async () => {
          const r = await s.pick();
          if (r)
            set({ ...r, alt: r.alt ?? img?.alt ?? "" });
        })));
      }
      if (img) {
        for (const a of config.actions ?? []) {
          if (!a.show(img))
            continue;
          bar.append(button(a.label, (b) => void run(b, async () => {
            const r = await a.run(img);
            if (isError(r))
              return fail(r.error);
            set(r);
          })));
        }
        bar.append(button("Remove", () => set(null)));
      }
    }
    root.append(bar);
    if (img) {
      const label = el("label", `${P}-label`, "Description (alt text, required)");
      const alt = el("input", `${P}-input`);
      alt.type = "text";
      alt.value = img.alt;
      alt.required = true;
      alt.disabled = api.readOnly.isEnabled;
      alt.setAttribute("aria-invalid", String(!img.alt.trim()));
      alt.oninput = () => {
        img = { ...img, alt: alt.value };
        alt.setAttribute("aria-invalid", String(!alt.value.trim()));
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

// src/index.ts
var YT_ID = /^[A-Za-z0-9_-]{11}$/;
var VIMEO_ID = /^\d{1,12}$/;
function url(text) {
  try {
    return new URL(text.trim());
  } catch {
    return null;
  }
}
var BUILT_IN = [
  {
    name: "youtube",
    label: "YouTube",
    parse(text) {
      const u = url(text);
      if (!u || !/^https?:$/.test(u.protocol))
        return null;
      const host = u.hostname.replace(/^(www|m)\./, "");
      let id = null;
      if (host === "youtu.be")
        id = u.pathname.split("/")[1] ?? null;
      else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        const [, kind, rest] = u.pathname.split("/");
        if (kind === "watch")
          id = u.searchParams.get("v");
        else if (kind === "shorts" || kind === "embed" || kind === "live")
          id = rest ?? null;
      }
      return id && YT_ID.test(id) ? id : null;
    },
    embed: (id) => `https://www.youtube.com/embed/${id}`
  },
  {
    name: "vimeo",
    label: "Vimeo",
    parse(text) {
      const u = url(text);
      if (!u || !/^https?:$/.test(u.protocol))
        return null;
      const host = u.hostname.replace(/^www\./, "");
      const parts = u.pathname.split("/").filter(Boolean);
      const id = host === "vimeo.com" ? parts[0] : host === "player.vimeo.com" && parts[0] === "video" ? parts[1] : undefined;
      return id && VIMEO_ID.test(id) ? id : null;
    },
    embed: (id) => `https://player.vimeo.com/video/${id}`
  }
];
function parseLink(text, providers) {
  const t = text.trim();
  if (!t)
    return null;
  for (const p of providers) {
    const id = p.parse(t);
    if (id)
      return { provider: p.name, id };
  }
  return null;
}
var uploadVisible = (config) => typeof config.upload === "function";
function normalize(data) {
  const o = data && typeof data === "object" ? data : {};
  const str = (v) => typeof v === "string" ? v : "";
  const poster = normalizeImage(o.poster);
  return { provider: str(o.provider), id: str(o.id), title: str(o.title), ...poster ? { poster } : {} };
}
var isValid = (d) => !!d.provider && !!d.id && d.title.trim() !== "";
var isEmpty = (d) => !d.provider && !d.id && !d.title.trim() && !d.poster;

class VideoTool {
  opts;
  data;
  root = el("div", "ejs-video");
  constructor(opts) {
    this.opts = opts;
    this.data = normalize(opts.data);
  }
  static get toolbox() {
    return { title: "Video", icon: '<svg width="17" height="15" viewBox="0 0 17 15"><rect x="1" y="2" width="15" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 5.5l4 2-4 2z" fill="currentColor"/></svg>' };
  }
  static get isReadOnlySupported() {
    return true;
  }
  render() {
    this.root.addEventListener("input", () => this.opts.block.dispatchChange());
    this.draw();
    return this.root;
  }
  save() {
    return this.data;
  }
  validate(data) {
    return !isEmpty(normalize(data));
  }
  get config() {
    return this.opts.config ?? {};
  }
  get providers() {
    return [...BUILT_IN, ...this.config.providers ?? []];
  }
  draw() {
    const d = this.data;
    const ro = this.opts.api.readOnly.isEnabled;
    this.root.replaceChildren();
    const box = el("div", "ejs-video-box");
    if (d.poster) {
      const p = el("img", "ejs-video-poster");
      p.src = d.poster.url;
      p.alt = d.poster.alt;
      box.append(p);
    }
    box.append(el("div", "ejs-video-play", "▶"));
    this.root.append(box);
    const status = el("div", "ejs-video-status");
    const showStatus = () => {
      const p = this.providers.find((x) => x.name === this.data.provider);
      status.textContent = this.data.id ? `${p?.label ?? this.data.provider}: ${this.data.id}` : "Paste a video link";
    };
    showStatus();
    const err = el("div", "ejs-video-error");
    err.setAttribute("role", "alert");
    if (!ro) {
      const link = el("input", "ejs-video-input");
      link.type = "text";
      link.placeholder = "Paste a YouTube or Vimeo link";
      link.oninput = () => {
        const hit = parseLink(link.value, this.providers);
        err.textContent = link.value.trim() && !hit ? "That is not a link this block can show." : "";
        if (hit) {
          this.data = { ...this.data, ...hit };
          showStatus();
        }
      };
      this.root.append(link);
      if (uploadVisible(this.config))
        this.root.append(this.uploadBar(showStatus, err));
    }
    this.root.append(status);
    const title = el("input", "ejs-video-input");
    title.type = "text";
    title.placeholder = "Title (required)";
    title.value = d.title;
    title.disabled = ro;
    title.required = true;
    title.setAttribute("aria-invalid", String(!d.title.trim()));
    title.oninput = () => {
      this.data.title = title.value;
      title.setAttribute("aria-invalid", String(!title.value.trim()));
    };
    this.root.append(title);
    this.root.append(el("div", "ejs-video-label", "Poster (optional)"));
    this.root.append(imageField({
      value: d.poster ?? null,
      config: { uploader: this.config.uploader, sources: this.config.sources, actions: this.config.actions },
      api: this.opts.api,
      onChange: (v) => {
        const { poster: _p, ...rest } = this.data;
        this.data = v ? { ...rest, poster: v } : rest;
      }
    }));
    this.root.append(err);
  }
  uploadBar(showStatus, err) {
    const bar = el("div", "ejs-video-bar");
    const file = el("input", "ejs-video-file");
    file.type = "file";
    file.accept = "video/*";
    file.hidden = true;
    const btn = el("button", "ejs-video-btn", "Upload a video");
    btn.type = "button";
    btn.onclick = () => file.click();
    const progress = el("span", "ejs-video-progress");
    file.onchange = async () => {
      const f = file.files?.[0];
      file.value = "";
      if (!f || !this.config.upload)
        return;
      btn.disabled = true;
      err.textContent = "";
      try {
        const r = await this.config.upload(f, (x) => {
          progress.textContent = `${Math.round(x * 100)}%`;
        });
        if (isError(r))
          err.textContent = r.error;
        else {
          this.data = { ...this.data, provider: r.provider, id: r.id };
          showStatus();
        }
      } catch (e) {
        err.textContent = e instanceof Error ? e.message : "The upload failed.";
      }
      progress.textContent = "";
      btn.disabled = false;
    };
    bar.append(file, btn, progress);
    return bar;
  }
}
export {
  BUILT_IN,
  VideoTool as default,
  isEmpty,
  isValid,
  normalize,
  parseLink,
  uploadVisible
};
