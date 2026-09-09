import path from 'node:path';

/**
 * Project root. Vite always runs from the template root (`dev`/`build`),
 * so the working directory is the stable base for every tool path below.
 */
export const ROOT = process.cwd();

// --- Sources (fixed inputs) ---

/** Liquid template source. Rendered in dev, emitted as dist output in build. */
export const TEMPLATE_SRC = path.join(ROOT, 'src/index.liquid');
/** Stylesheet source. Served directly in dev, bundled via rollup in build. */
export const STYLES_SRC = path.join(ROOT, 'src/styles.css');
/**
 * Script entry source. Bundled only when the `script` capability is set;
 * dev also requires this file to exist before injecting the script tag.
 */
export const MAIN_SRC = path.join(ROOT, 'src/main.ts');

// --- Tool inputs ---

/** Plugin manifest source (manifest-relevant keys only, no tooling keys). */
export const ZENSO_CONFIG_PATH = path.join(ROOT, 'zenso.config.json');
/** Source of name/version/author/description/license merged into outputs. */
export const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
/** Working mock context for dev. Auto-generated when enabled, git-ignored. */
export const MOCK_PATH = path.join(ROOT, 'mock/plugin.json');
/** Checked-in neutral `zenso` scope content (`user`/`device`/`system`), wrapped under `zenso` at resolve time. */
export const MOCK_DEFAULTS_PATH = path.join(ROOT, 'mock/zenso.json');

// --- Dev vs prod asset references ---

/** Dev serves source files with HMR, build uses bundled output. */
/** Stylesheet href injected into `head` by the dev server. */
export const DEV_STYLES_HREF = '/src/styles.css';
/** Stylesheet href injected into `head` at build time. */
export const PROD_STYLES_HREF = 'assets/styles.css';
/** Script src injected into `head` by the dev server. */
export const DEV_MAIN_SRC = '/src/main.ts';
/** Script src injected into `head` at build time. */
export const PROD_MAIN_SRC = 'assets/main.js';

// --- Dist contract (backend-facing names) ---

/**
 * Backend expects {@link TEMPLATE_FILENAME} at the zip root;
 * everything else lives under {@link ASSETS_DIR}.
 */
/** Build output directory, also the zip input. */
export const OUT_DIR = 'dist';
/** Bundled asset directory inside the output. */
export const ASSETS_DIR = 'assets';
/** Emitted manifest file name (validated strictly by the backend). */
export const MANIFEST_FILENAME = 'manifest.json';
/** Emitted template file name (required at the zip root). */
export const TEMPLATE_FILENAME = 'index.liquid';
/** Zip archive produced after build. */
export const ZIP_FILENAME = 'plugin.zip';
