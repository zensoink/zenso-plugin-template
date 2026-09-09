import fs from 'node:fs';
import { PACKAGE_JSON_PATH, ZENSO_CONFIG_PATH } from './constants';

/**
 * Reads and parses the plugin manifest source.
 *
 * @returns The raw `zenso.config.json` contents.
 * @throws When the file is missing or contains invalid JSON.
 */
export function readZensoConfig(): any {
    return JSON.parse(fs.readFileSync(ZENSO_CONFIG_PATH, 'utf-8'));
}

/**
 * Reads and parses `package.json`.
 *
 * @returns The parsed contents, or an empty object when the file
 * is missing or invalid (callers treat every key as optional).
 */
export function readPackageJson(): any {
    try {
        return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

/**
 * Checks whether the plugin declares the `script` capability,
 * which permits bundled `.js` files in the backend validator.
 *
 * @returns True when `capabilities` includes `"script"`, false otherwise
 * (including when the config cannot be read).
 */
export function hasScriptCapability(): boolean {
    try {
        const cfg = readZensoConfig();
        return Array.isArray(cfg.capabilities) && cfg.capabilities.includes('script');
    } catch {
        return false;
    }
}

/**
 * Builds the shippable `manifest.json` from the two local sources.
 *
 * | Key                                          | Source             |
 * |----------------------------------------------|--------------------|
 * | `id`, `thumbnail`, `schema_version`,         | `zenso.config.json`|
 * | `core_min`, `capabilities`, `config_schema`, |                    |
 * | `data_sources`                               |                    |
 * | `name`, `version`, `author`, `description`,  | `package.json`     |
 * | `license`                                    |                    |
 *
 * @returns The manifest object, ready for `JSON.stringify`.
 * @throws When `package.json` lacks a non-empty `name` or a SemVer
 * `version` — both are merged here and required by the backend validator,
 * so the build fails fast instead of producing a ZIP the upload rejects.
 * @remarks Keys are allowlisted explicitly, so tooling keys added to
 * `zenso.config.json` in the future can never leak to the backend.
 */
export function buildManifestJson(): Record<string, any> {
    const zensoConfig = readZensoConfig();
    const pkg = readPackageJson();
    // ponytail: mirror only what the backend requires of merged keys (name non-empty,
    // version SemVer); full-manifest validation stays the backend's job
    if (typeof pkg.name !== 'string' || pkg.name.length === 0) {
        throw new Error('zenso: package.json must provide a non-empty "name" (merged into dist/manifest.json, required by the backend)');
    }
    if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
        throw new Error('zenso: package.json must provide a SemVer "version" like "1.2.3" (merged into dist/manifest.json, required by the backend)');
    }
    return {
        $schema: 'https://schemas.zenso.ink/v1/plugin-manifest.schema.json',
        id: zensoConfig.id,
        name: pkg.name,
        thumbnail: zensoConfig.thumbnail,
        description: pkg.description,
        schema_version: zensoConfig.schema_version,
        version: pkg.version,
        core_min: zensoConfig.core_min,
        license: pkg.license,
        capabilities: zensoConfig.capabilities,
        author: pkg.author,
        config_schema: zensoConfig.config_schema,
        data_sources: zensoConfig.data_sources
    };
}
