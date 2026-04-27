# Kiwrious SDK Documentation

Developer documentation for the Kiwrious USB serial sensor SDK — a single-page static site with sidebar navigation, syntax highlighting, and copy-to-clipboard code snippets, plus a mirrored markdown copy for AI/LLM consumption.

## What's in here

```
kiwrious-sdk-docs/
├── index.html              ← Single-page app shell (app bar + sidebar + content)
├── assets/
│   ├── css/styles.css      ← Modern stylesheet
│   ├── js/app.js           ← Hash router + markdown renderer + copy buttons
│   └── img/                ← Logo
├── content/                ← Markdown docs rendered at runtime by the site
│   ├── home.md
│   ├── installation.md
│   ├── quickstart.md
│   ├── protocol/           ← USB connection, frame format, sensor types, firmware
│   ├── api/                ← SerialService, callbacks, interfaces, enums
│   ├── sensors/            ← UV, humidity, temperature, conductivity, VOC, heart rate
│   ├── advanced/           ← DSP pipeline, ARM emulator, disconnect/resume, discrepancies
│   └── examples/           ← Vue, Scratch, recording/CSV
├── ai-docs/                ← Same content, structured for AI/LLM consumption
├── lib/                    ← Runtime binary assets used by the SDK (heart rate v2)
│   ├── prog.bin
│   ├── libunicorn_out.{js,wasm}
│   ├── unicorn-{wrapper,constants}.js
│   ├── libelf-integers.js
│   ├── heartrate.js
│   └── README.md
├── DISCREPANCIES.md        ← Top-level cross-project bug list
├── .vscode/
│   ├── launch.json         ← "Open Kiwrious SDK Docs in Chrome/Edge"
│   └── tasks.json          ← "Serve docs (http-server)" / "Serve docs (Python)"
└── package.json            ← npm scripts: serve / open
```

## Run locally

Pick one:

```bash
npm run serve              # uses npx http-server on :8080
# or
npm run serve:py           # uses python3 -m http.server on :8080
# or in VSCode:
#   ▷ Run → "Open Kiwrious SDK Docs in Chrome"
```

Open `http://localhost:8080`.

> The site fetches markdown files from `content/` at runtime, so it must be served — `file://` won't work because of CORS.

## Why a static SPA?

- **Zero build step.** No Webpack, no Vite, no React. Open `index.html` in a server and it runs.
- **Markdown is the source of truth.** Everything in `content/` is plain `.md` — readable in any editor, diffable in Git, consumable by LLMs.
- **AI mirror.** `ai-docs/` is a flatter copy structured for context windows: shorter, cross-referenced, no HTML.
- **Fast.** ~50 KB of HTML/CSS/JS plus a few hundred KB of markdown. No JavaScript bundler.

## Authoring

Each markdown file in `content/` is a route. The route is the file path minus `.md`:

| File | Route |
|---|---|
| `content/home.md` | `#/home` |
| `content/protocol/frame-format.md` | `#/protocol/frame-format` |
| `content/sensors/heart-rate.md` | `#/sensors/heart-rate` |

The sidebar (in `index.html`) maps display names to route IDs via `data-route="…"`.

### Custom blockquote callouts

Prefix a blockquote with `{info}`, `{warn}`, or `{bug}` for styled callouts:

```markdown
> {info}
> Heart rate v2 only requires the emulator.

> {warn}
> Web Serial requires a secure context.

> {bug}
> Conductivity flag bug in scratch-gui — see discrepancies.
```

## VSCode

- **F5** launches Chrome (or Edge) at `http://localhost:8080` and starts the dev server as a pre-task.
- The `Serve docs` task can also be run independently from the Command Palette → `Tasks: Run Task`.

## AI consumption

For AI/LLM use, point at [`ai-docs/`](ai-docs/) — it mirrors the site content but is denser and avoids the SPA shell. Start at [`ai-docs/README.md`](ai-docs/README.md) for an index.

## Known discrepancies across projects

See [DISCREPANCIES.md](DISCREPANCIES.md) (top-level summary) and [`content/advanced/discrepancies.md`](content/advanced/discrepancies.md) (full detail with citations).

## Source projects analysed

| Project | Role |
|---|---|
| `kiwrious-web-serial-sdk` | Canonical SDK (v2.x, ESM, TypeScript) |
| `kiwrious-webserial-library` | Legacy npm library (v1.x, CommonJS) |
| `kiwrious-measure-vue` | Reference consumer Vue 2 app |
| `scratch-gui` | Block-based programming UI with embedded Kiwrious extension |
| `kiwrious-cdn` | Static asset CDN (logos, sensor images) |
| `kiwrious-website*` | Marketing sites (no relevant SDK code) |

## License

MIT
