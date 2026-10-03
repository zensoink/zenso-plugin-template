# Zenso Plugin Developer Guide

A comprehensive guide for developing widgets and plugins for the Zenso e-ink ecosystem.

---

## 1. Architecture Overview

A Zenso plugin consists of:
1. **Liquid Template** (`src/index.liquid`): Defines the HTML structure and presentation.
2. **Configuration Contract** (`zenso.config.json`): Declares schema, capabilities, and data sources.
3. **Package Metadata** (`package.json`): Provides name, version, author, and description.

The Zenso backend executes rendering server-side:
$$\text{Liquid Template} \xrightarrow{\text{Data Context}} \text{HTML} \xrightarrow{\text{Chromium}} \text{Screenshot} \xrightarrow{\text{Sharp}} \text{Dithered 4bpp/7-color image}$$

> **Important:** Zenso displays are static e-ink devices. There is no client-side user interactivity (no mouse clicks, scrolling, or continuous animations). The final output pushed to the physical screen is a static, dithered image.

---

## 2. Project Structure

```
├── src/
│   ├── index.liquid       # Liquid template entry point
│   ├── styles.css         # E-ink optimized stylesheet
│   └── main.ts            # Optional client-side script (only if "script" capability enabled)
├── public/
│   ├── assets/            # Static assets shipped in plugin (e.g. logos, icons)
│   └── favicon.ico        # Plugin icon displayed in panel and browser dev
├── mock/                  # Development-only mock fixtures
│   ├── zenso.json         # Base mock for system, user, and device variables
│   └── plugin.json        # Instance settings and data source stubs (auto-synced)
├── zenso.config.json      # Plugin capabilities, config schema, data sources
├── package.json           # Plugin metadata (name, version, author, license)
├── vite.config.ts         # Vite configuration with @zenso/vite-plugin
└── dist/                  # Generated build output and plugin.zip package
```

---

## 3. Getting Started

### Prerequisites
- Node.js 20+
- npm / pnpm

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```
- Opens local dev server with Hot Module Replacement (HMR).
- Renders `src/index.liquid` inside browser viewport matching your target display.
- Automatically reloads on changes to templates, styles, scripts, or configuration.

### Production Build
```bash
npm run build
```
Emits:
- `dist/index.liquid`: Template with production asset paths.
- `dist/manifest.json`: Verified plugin manifest merged from `zenso.config.json` and `package.json`.
- `dist/assets/*`: Bundled scripts and styles.
- `plugin.zip`: Complete packaged bundle ready for installation in Zenso Panel.

---

## 4. Mock Data System

During local development, `@zenso/vite-plugin` resolves mock data in hierarchical layers (highest precedence wins):

| Precedence | Layer | Source | Description |
|:---:|:---|:---|:---|
| 1 (Highest) | Inline Mocks | `vite.config.ts` (`mock:` option) | Direct overrides in configuration |
| 2 | Instance Mocks | `mock/plugin.json` | Plugin-specific config and data overrides (git-ignored) |
| 3 | System Base | `mock/zenso.json` | Default device, system, and user variables |
| 4 (Lowest) | Schema Defaults | `zenso.config.json` | Derived defaults from `config_schema` and `data_sources` |

`zenso.system.timestamp_utc` is stamped with the real-time UTC clock on every render, mimicking backend behavior.

---

## 5. Configuration & Manifest Contract

### `zenso.config.json`
Specifies plugin mechanics and schema:
```json
{
  "$schema": "https://schemas.zenso.ink/v1/plugin-manifest.schema.json",
  "id": "starter-plugin",
  "capabilities": ["script"],
  "config_schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "title": "Widget Title",
        "default": "Hello World"
      },
      "show_footer": {
        "type": "boolean",
        "title": "Show Footer",
        "default": true
      }
    }
  },
  "data_sources": []
}
```

- `config_schema`: JSON Schema (Draft-07) defining instance form fields rendered in Zenso Panel. If no configuration is required, provide `{"type": "object", "properties": {}}`.
- `capabilities`:
  - `[]`: Pure Liquid template (recommended for performance).
  - `["script"]`: Enables JavaScript bundling (`src/main.ts`).

### Data Sources (Server-side Fetching)
Declare external feeds for backend fetching:
```json
"data_sources": [
  {
    "id": "events",
    "type": "ics",
    "config": {
      "urls_field": "feed_urls",
      "days_ahead_field": "days_ahead"
    }
  }
]
```
The backend fetches feeds before template compilation and injects the resulting data into the `data.<id>` template scope.

---

## 6. Template Context

Every Liquid template has access to four global variables:

| Variable | Scope | Examples |
|---|---|---|
| `zenso` | System environment | `zenso.user.locale`, `zenso.user.time_zone_iana`, `zenso.device.width`, `zenso.device.height` |
| `plugin` | Plugin metadata | `plugin.id`, `plugin.name`, `plugin.version` |
| `config` | User instance settings | Values configured according to `config_schema` (e.g. `config.title`) |
| `data` | Injected data feeds | Output from declared `data_sources` (e.g. `data.events`) |

### Liquid Filters & Asset Helper
The custom filter `asset_url` resolves relative asset paths in both development and production:
```liquid
<img src="{{ 'assets/logo.png' | asset_url }}" alt="Logo" />
```

---

## 7. Optional JavaScript Execution

When `"capabilities": ["script"]` is specified:
1. Write your client-side logic in `src/main.ts`.
2. Perform any dynamic DOM manipulation or calculations (such as charting or date math).
3. Signal completion to the Zenso backend screenshot engine:
```typescript
// Signal ready for screenshot capture
window.__ZENSO_READY__ = true;
```

> **Warning:** Always set `window.__ZENSO_READY__ = true` when your script finishes rendering. If omitted, the backend will wait until timeout, potentially capturing an incomplete frame.
