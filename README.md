# Zenso Plugin Template

A starter template for developing Zenso widgets and plugins for e-ink displays.

A plugin is a [Liquid](https://liquidjs.com/tutorials/intro-to-liquid.html) template (`templates/index.liquid`)
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
- `mock-data.json` for local development without backend access (auto-synced)
- E-ink-friendly CSS entry (`src/styles.css`)
- GitHub Actions CI/CD: signed releases (`plugin.zip` + sha256 + Cosign bundle)

## Project Structure

```
├── templates/        # Liquid template (index.liquid)
├── src/              # Entry CSS (styles.css), entry JS (main.ts, script capability only)
├── public/assets/    # Static files shipped verbatim (e.g. assets/logo.png)
├── mock-data.json    # Mock template context for local development (auto-synced, git-ignored scratch allowed)
├── zenso.config.json # Plugin contract source: id, capabilities, config_schema, data_sources
├── package.json      # Plugin metadata source: name, version, author, description, license
├── vite.config.ts    # Dev + build settings (only `dev` and `build` scripts)
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

`/` renders `templates/index.liquid` with the context from `mock-data.json`.
CSS (`src/styles.css`) and JS (`src/main.ts`, script capability only) are injected
automatically — dev uses `/src/*` paths with HMR, production builds use `assets/*`.
Templates, mock data, `zenso.config.json`, and `package.json` are watched;
editing config re-syncs the mock and triggers a full reload.

### Mock data

`mock-data.json` mirrors the production template context:

```json
{
  "zenso": { "user": {}, "device": {}, "system": {} },
  "plugin": { "id": "...", "name": "...", "version": "..." },
  "config": {},
  "data": {}
}
```

It is auto-synced on dev/build from `zenso.config.json` (config defaults from
`config_schema` properties, data stubs from `data_sources`) and `package.json`
(plugin name/version/author/description), plus built-in `zenso` device/user defaults.
Sync only fills in missing keys — your edits are preserved. The `data.<id>` entries
are local `{type, config}` stubs; the backend expands them into real fetched data
in production.

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
  "required": ["calendar_feeds"],
  "properties": {
    "view": {
      "type": "string", "enum": ["list", "month", "week", "day"], "default": "list"
    },
    "days_ahead": {
      "type": "number", "minimum": 1, "maximum": 60, "default": 14
    },
    "calendar_feeds": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["url", "color"],
        "properties": {
          "url": { "type": "string", "format": "uri" },
          "color": { "type": "string", "format": "color", "default": "#3b82f6" }
        }
      }
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
    "id": "calendar",
    "type": "ics",
    "config": { "urls_field": "calendar_feeds", "days_ahead_field": "days_ahead" }
  }
]
```

The backend fetches the feeds from the instance's settings and injects the result
(e.g. `data.calendar`) into the template. Locally, `data.calendar` is just the
declared stub — shape your template against the backend's documented payload.

### Template context

Available in every template (keys of `mock-data.json`):

| Variable | Source |
| -------- | ------ |
| `zenso`  | Backend: `user` (locale, `time_zone_iana`), `device`, `system` |
| `plugin` | This plugin's identity (`id` from config, rest from `package.json`) |
| `config` | This plugin instance's settings (validated against `config_schema`) |
| `data`   | One entry per `data_sources` item, keyed by its `id` |

The only registered Liquid filter is `asset_url` (used for static files,
e.g. `{{ 'assets/logo.png' | asset_url }}`).
For Liquid syntax see the [official Liquid tutorial](https://liquidjs.com/tutorials/intro-to-liquid.html).

### Getting an ICS feed URL (example source)

**Google Calendar:** calendar Settings → *Integrate calendar* → copy the
*Secret address in iCal format* URL.

**Apple iCloud:** share the calendar as *Public Calendar*, copy the public `.ics` URL.
Note: iCloud feeds can lag several minutes behind edits.

## JavaScript (opt-in)

Pure-Liquid plugins need no JS — delete `src/main.ts` and drop `"script"` from
`capabilities`. If you need render-time computation (charts, layouts):

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
