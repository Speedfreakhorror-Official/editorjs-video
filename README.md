# editorjs-video

A video block for Editor.js: paste a YouTube or Vimeo link, add a title and a poster; hosts can add providers and an upload.

## Install

```
npm i github:Speedfreakhorror-Official/editorjs-video
```

Import the tool and its stylesheet:

```ts
import VideoTool from 'editorjs-video';
import 'editorjs-video/style.css';
```

## Usage

```ts
new EditorJS({ tools: { video: { class: VideoTool, config: { providers: [], upload, uploader } } } });
```

The stylesheet reads these CSS variables, with light and dark defaults on `:root`; override them on any parent element:
`--ejs-ink`, `--ejs-muted`, `--ejs-line`, `--ejs-surface`, `--ejs-accent`, `--ejs-danger`.

## Data

```json
{ "provider": "youtube", "id": "dQw4w9WgXcQ", "title": "...", "poster": { "url": "...", "width": 800, "height": 600, "alt": "..." } }
```

Config: `providers` (extra `{ name, label, parse(text), embed(id) }` added to the built-in YouTube and Vimeo), `upload(file, onProgress)` (without it there is no upload button), `uploader`, `sources` and `actions` for the poster (as the picture tool's). Also exported: `parseLink(text, providers)` and `BUILT_IN`. The editor never loads a video frame; it shows the poster or a play box.

`ImageConfig` (all optional, passed as the tool's `config`):

- `uploader(file)` resolves `{ url, width, height }` or `{ error }`; without it there is no upload button.
- `sources` adds buttons that pick a picture some other way: `{ label, pick() }`.
- `actions` adds buttons shown for a picture: `{ label, show(img), run(img) }`.

Every picture needs a description (`alt`): `isValid` checks it and everything else the block needs. `validate` refuses only an empty block, so Editor.js never drops a half-made one from a save; check `isValid` before you publish. Extra fields on a picture object are kept.

The module also exports a pure `normalize(data)` that fills defaults and drops unknown top-level keys.

## Credits

Built as part of [PrintCut](https://printcut.app), a browser studio for designing laser-cut boxes, puzzles, keychains and signs from templates. Made and owned by [ibrahim-jaber.com](https://ibrahim-jaber.com).
