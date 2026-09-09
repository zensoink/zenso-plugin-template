# Zenso Plugin Template

A starter template for developing Zenso widgets and plugins for e-ink displays.

A plugin is a [Liquid](https://liquidjs.com/tutorials/intro-to-liquid.html) template (`src/index.liquid`)
plus a `manifest.json` contract. The Zenso backend renders it server-side — Liquid → HTML →
headless-Chromium screenshot → PNG → dithered 4bpp image — and pushes the result to the device.
There is no client-side interactivity: the output is a static image.

## Features

- Liquid template rendering with Vite dev server (hot reload)
- `manifest.json` generated at build from `zenso.config.json` + `package.json`,
  validated against the canonical schema
  (`https://schemas.zenso.ink/v1/plugin-manifest.schema.json`)
- `config_schema` contract for per-instance plugin settings
- `data_sources` contract for server-side data fetching (e.g. ICS feeds)
- Optional `script` capability: bundled JS rendered before screenshot
- Layered mocks for local development without backend access
  (`mock/zenso.json` + `mock/plugin.json` + inline `mock:` option, dev-only)
- E-ink-friendly CSS entry (`src/styles.css`)
- GitHub Actions CI/CD: signed releases (`plugin.zip` + sha256 + Cosign bundle)

## Project Structure

```
├── src/              # Liquid template (index.liquid), entry CSS (styles.css), entry JS (main.ts, script capability only)
├── public/assets/    # Static files shipped verbatim (e.g. assets/logo.png)
├── public/favicon.ico # Plugin-list icon (referenced from the template head)
├── mock/             # Dev-only mock layers: zenso.json (checked-in base) + plugin.json (sparse overrides, git-ignored)
├── tools/zenso/      # Plugin toolkit source (dev server, build emit, mock resolution); extracted to an npm package later
├── zenso.config.json # Plugin contract source: id, capabilities, config_schema, data_sources
├── package.json      # Plugin metadata source: name, version, author, description, license
├── vite.config.ts    # Just `plugins: [zensoPlugin()]`; user `build` values merge over plugin defaults
└── dist/             # Build output (git-ignored); plugin.zip emitted next to it
```

## Getting Started

### Prerequisites

Node 20+, npm.

```bash
npm install
```

### Development

```bash
npm run dev    # Start dev server with hot reload (mock data)
```

`/` renders `src/index.liquid` with the resolved mock context (see below).
CSS (`src/styles.css`) and JS (`src/main.ts`, script capability only) are injected
automatically — dev uses `/src/*` paths with HMR, production builds use `assets/*`.
Template, mock files, `zenso.config.json`, and `package.json` are watched;
editing config re-syncs the sparse mock overrides and triggers a full reload.

### Mock data

The dev context resolves at render time by layering (highest wins):

| Layer | Source |
| ----- | ------ |
| Inline `mock:` option | `zensoPlugin({ mock: {...} })` — object or spread of imported JSONs |
| `mock/plugin.json` | Sparse `plugin`/`config`/`data` overrides (git-ignored, auto-synced) |
| `mock/zenso.json` | Checked-in neutral `zenso` scope (`user`/`device`/`system`) |
| Derived defaults | `plugin` identity from `package.json`, `config` from `config_schema`, `data` stubs from `data_sources` |

```ts
// vite.config.ts — compose extra mocks with plain imports and spread
import zensoMock from './mock/zenso.json';
import pluginMock from './mock/plugin.json';
import realMock from './mock/real.json';

zensoPlugin({ mock: { ...zensoMock, ...pluginMock, ...realMock } })
```

Top-level `user`/`device`/`system` keys fold into the `zenso` scope, so
`{...zensoMock}` spreads compose. Sync only fills missing keys in
`mock/plugin.json` — your overrides are preserved and the `zenso` scope is
never written there. `zenso.system.timestamp_utc` is stamped with the current
time on every render (the backend does the same in production), so the clock
is always live; `mock/zenso.json` on disk keeps its static fixture value. The `data.<id>` entries are local `{type, config}`
stubs; the backend expands them into real fetched data in production.
Mocks are dev-only: `npm run build` never reads or writes `mock/`.

### Plugin options

`zensoPlugin()` takes three optional flags (defaults preserve template behavior):

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `generateMockData` | `true` | Derive config-based layers + sync sparse `mock/plugin.json` (dev only). `false` renders files + inline data only. |
| `mock` | — | Inline mock data, highest-precedence layer (see above). |
| `zip` | `true` | Pack `dist/` into `plugin.zip` after build. Object overrides zipPack options, `false` disables. |

Build defaults (`outDir`, rollup inputs/outputs) come from the plugin's
`config()` hook — your own `build` values in `vite.config.ts` merge over them.

### Build

```bash
npm run build   # Production build: dist/ + plugin.zip
```

The build emits `dist/index.liquid` (template with production head assets injected),
`dist/manifest.json` (assembled from `zenso.config.json` + `package.json`),
bundled `dist/assets/*`, static files from `public/`, and packs it all into
`plugin.zip` via `vite-plugin-zip-pack`. The ZIP is what gets installed as a plugin.

## Configuration

Plugin identity is split across two files. `manifest.json` is never edited by hand —
it is generated at build:

| Field | Source |
| ----- | ------ |
| `id`, `thumbnail`, `schema_version`, `core_min`, `capabilities`, `config_schema`, `data_sources` | `zenso.config.json` |
| `name`, `version`, `description`, `license`, `author` | `package.json` |

### config_schema

```json
"config_schema": {
  "type": "object",
  "properties": {
    "title": {
      "type": "string", "default": "Hello"
    },
    "show_footer": {
      "type": "boolean", "default": true
    }
  }
}
```

`config_schema` is JSON Schema (draft-07). A no-config plugin uses
`{"type": "object", "properties": {}}` (a bare `{}` fails backend validation).

### Data sources (server-side fetching)

Declare what the backend should fetch and inject into your template context:

```json
"data_sources": [
  {
    "id": "events",
    "type": "ics",
    "config": { "urls_field": "feed_urls", "days_ahead_field": "days_ahead" }
  }
]
```

The backend fetches the declared sources from the instance's settings and
injects the result (e.g. `data.events`) into the template. Locally,
`data.events` is just the declared stub — shape your template against the
backend's documented payload. Supported source types (e.g. `ics`) and their
`config` keys are defined by the backend; feed URLs themselves come from the
plugin instance settings (`config`), not from this file.

### Template context

Available in every template (the resolved mock context mirrors it locally):

| Variable | Source |
| -------- | ------ |
| `zenso`  | Backend: `user` (locale, `time_zone_iana`), `device`, `system` |
| `plugin` | This plugin's identity (`id` from config, rest from `package.json`) |
| `config` | This plugin instance's settings (validated against `config_schema`) |
| `data`   | One entry per `data_sources` item, keyed by its `id` |

The only registered Liquid filter is `asset_url` (used for static files,
e.g. `{{ 'assets/logo.png' | asset_url }}`).
For Liquid syntax see the [official Liquid tutorial](https://liquidjs.com/tutorials/intro-to-liquid.html).

### Plugin icon

`public/favicon.ico` is the plugin's icon: it ships verbatim in the ZIP and is
loaded into the plugin list. It is also referenced from the template head
(`<link href="{{ 'favicon.ico' | asset_url }}" rel="icon">`), so the dev page
and the screenshot share the same icon. Replace the file with your own icon —
keep the `favicon.ico` name and location. (The manifest `thumbnail` is a
separate, larger preview image.)

## JavaScript (opt-in)

Pure-Liquid plugins need no JS — delete `src/main.ts` and drop `"script"` from
`capabilities`. If you need render-time computation (charts, layouts, locale
formatting — the starter formats the device time from the template context):

1. Keep `"capabilities": ["script"]` in `zenso.config.json`.
2. Write `src/main.ts` — it is bundled to `assets/main.js` and injected as
   `<script type="module">` automatically. No extra Vite config needed.
3. At the end of your JS, after rendering: `window.__ZENSO_READY__ = true`.
   The backend screenshots anyway on timeout — always set the flag, or risk
   a half-rendered frame.

Output is a static screenshot, never interactive.

## Deployment

Trigger a release by creating a git tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

CI (`release.yml`) runs `npm ci` → `npm run build` (which emits `plugin.zip`) →
writes a sha256 checksum → signs the ZIP with Cosign (keyless, via `id-token: write`) →
publishes a GitHub Release with `plugin.zip`, `plugin.zip.sha256`, `plugin.zip.bundle`.

## License

MIT
