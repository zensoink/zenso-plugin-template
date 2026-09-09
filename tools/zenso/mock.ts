import fs from 'node:fs';
import { MOCK_DEFAULTS_PATH, MOCK_PATH, ZENSO_CONFIG_PATH } from './constants';
import { readPackageJson, readZensoConfig } from './manifest';

/**
 * Narrows an unknown value to a plain (non-array) object.
 *
 * @param v - The value to check.
 * @returns True for plain objects only; arrays and primitives return false.
 */
export function isPlainObject(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fills paths missing in `target` from `defaults`, recursing into plain objects.
 * Arrays are treated as atomic values: an existing array is never merged item-wise.
 *
 * @param target - The object to fill (mutated in place and returned).
 * @param defaults - The fallback values (only read, never mutated).
 * @returns The mutated `target`.
 */
export function fillMissing(target: Record<string, any>, defaults: Record<string, any>): Record<string, any> {
    for (const [key, value] of Object.entries(defaults)) {
        if (target[key] === undefined) {
            target[key] = value;
        } else if (isPlainObject(value) && isPlainObject(target[key])) {
            fillMissing(target[key], value);
        }
    }
    return target;
}

/**
 * Derives the mock `plugin` scope: `id` from the zenso config,
 * display keys from `package.json`.
 *
 * @param zensoConfig - The parsed `zenso.config.json` contents.
 * @returns The `plugin` scope defaults (only keys present in the sources).
 */
export function buildPluginMock(zensoConfig: any): Record<string, any> {
    const pkg = readPackageJson();
    const plugin: Record<string, any> = {};
    if (zensoConfig.id !== undefined) plugin.id = zensoConfig.id;
    for (const key of ['name', 'version', 'author', 'description']) {
        if (pkg[key] !== undefined) plugin[key] = pkg[key];
    }
    return plugin;
}

/**
 * Derives the mock `config` scope from `config_schema` field definitions.
 * Each field falls back to its `default`, then to a type-based placeholder:
 * first `enum` entry or `''` for strings, `minimum ?? 0` for numbers,
 * `false` for booleans, one synthesized object row (or `[]`) for arrays.
 *
 * @param properties - The `config_schema.properties` map (or anything else).
 * @returns The `config` scope defaults, or `{}` for missing/invalid input.
 */
export function buildConfigMock(properties: any): Record<string, any> {
    const config: Record<string, any> = {};
    if (!properties || typeof properties !== 'object') return config;
    for (const [key, field] of Object.entries<any>(properties)) {
        if (field.default !== undefined) {
            config[key] = field.default;
        } else if (field.type === 'string') {
            config[key] = field.enum ? field.enum[0] : '';
        } else if (field.type === 'number') {
            config[key] = field.minimum ?? 0;
        } else if (field.type === 'boolean') {
            config[key] = false;
        } else if (field.type === 'array') {
            if (field.items && field.items.type === 'object' && field.items.properties) {
                const itemObj: Record<string, any> = {};
                for (const [subKey, subField] of Object.entries<any>(field.items.properties)) {
                    itemObj[subKey] = subField.default !== undefined
                        ? subField.default
                        : (subField.enum ? subField.enum[0] : '');
                }
                config[key] = [itemObj];
            } else {
                config[key] = [];
            }
        }
    }
    return config;
}

/**
 * Derives the mock `data` scope from declared data sources.
 *
 * @param dataSources - The `data_sources` array from the zenso config.
 * @returns One entry per source with an `id`, shaped as `{ type, config }`.
 */
export function buildDataMock(dataSources: any): Record<string, any> {
    const data: Record<string, any> = {};
    if (Array.isArray(dataSources)) {
        dataSources.forEach((ds: any) => {
            if (ds?.id) data[ds.id] = { type: ds.type, config: ds.config };
        });
    }
    return data;
}

const warnedMissing = new Set<string>();

/**
 * Reads a JSON file, tolerating absence and invalid content.
 * A missing file logs a one-time dev warning (likely a typo or accidental
 * deletion); invalid content stays silent and resolves to `{}`.
 *
 * @param filePath - Absolute path to the JSON file.
 * @returns The parsed object, or `{}` when missing, invalid, or not an object.
 */
function readJsonFile(filePath: string): Record<string, any> {
    if (!fs.existsSync(filePath)) {
        if (!warnedMissing.has(filePath)) {
            warnedMissing.add(filePath);
            console.warn(`[zenso] mock file not found: ${filePath} — rendering with empty scope`);
        }
        return {};
    }
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return isPlainObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Syncs the sparse `mock/plugin.json` overrides from `zenso.config.json`:
 * fills missing derived `{plugin, config, data}` values, never overwrites
 * existing ones, preserves hand-added scopes, and strips the `zenso` scope
 * (it lives solely in `mock/zenso.json` — no duplicated copies).
 */
export function syncMockSparse() {
    if (!fs.existsSync(ZENSO_CONFIG_PATH)) return;
    const zensoConfig = readZensoConfig();
    const existing = readJsonFile(MOCK_PATH);
    const asObject = (v: unknown): Record<string, any> => (isPlainObject(v) ? v : {});

    // ponytail: seeds are cloned so the write check below compares against
    // the untouched file content — filling the live refs would always compare equal
    const merged: Record<string, any> = {
        plugin: fillMissing(structuredClone(asObject(existing.plugin)), buildPluginMock(zensoConfig)),
        config: fillMissing(structuredClone(asObject(existing.config)), buildConfigMock(zensoConfig.config_schema?.properties)),
        data: fillMissing(structuredClone(asObject(existing.data)), buildDataMock(zensoConfig.data_sources))
    };
    for (const [key, value] of Object.entries(existing)) {
        if (!(key in merged) && key !== 'zenso') merged[key] = value;
    }

    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
        fs.writeFileSync(MOCK_PATH, JSON.stringify(merged, null, 2), 'utf-8');
        console.log(`[zenso] mock synced: ${MOCK_PATH}`);
    }
}

/**
 * Resolves the render-time mock context by layering (highest wins):
 * inline option → `mock/plugin.json` → `mock/zenso.json` → derived defaults.
 * Layers merge scope-wise via {@link fillMissing}, so arrays and scalars
 * from a higher layer win wholesale while missing paths fall through.
 *
 * `mock/zenso.json` holds the bare `zenso` scope content
 * (`user`/`device`/`system`) and is wrapped under `zenso` automatically.
 * The same applies to the inline layer: top-level `user`/`device`/`system`
 * keys are folded into the `zenso` scope, so `{...zensoMock}` spreads compose.
 *
 * `zenso.system.timestamp_utc` is stamped with the current time on every
 * resolve (when a `zenso` scope exists): the backend injects current time on
 * every render, so a frozen fixture value would be wrong mock data. The stamp
 * is render-time only — no file is ever modified for it.
 *
 * @param inline - Inline mock data from the plugin option (or `{}`).
 * @param derive - Whether to derive the lowest layer from `zenso.config.json`
 * + `package.json`. False renders files + inline only.
 * @returns The merged `{ zenso, plugin, config, data }` context (plus any
 * hand-added scopes found in the files).
 */
export function resolveMockData(inline?: Record<string, any>, derive = true): Record<string, any> {
    let derived: Record<string, any> = {};
    if (derive && fs.existsSync(ZENSO_CONFIG_PATH)) {
        const zensoConfig = readZensoConfig();
        derived = {
            plugin: buildPluginMock(zensoConfig),
            config: buildConfigMock(zensoConfig.config_schema?.properties),
            data: buildDataMock(zensoConfig.data_sources)
        };
    }
    const base: Record<string, any> = {
        zenso: structuredClone(readJsonFile(MOCK_DEFAULTS_PATH))
    };
    const fromFiles = fillMissing(
        structuredClone(readJsonFile(MOCK_PATH)),
        fillMissing(base, derived)
    );
    const raw = isPlainObject(inline) ? structuredClone(inline) : {};
    const { user, device, system, zenso, ...rest } = raw;
    const top: Record<string, any> = { ...rest };
    const bare: Record<string, any> = {};
    if (user !== undefined) bare.user = user;
    if (device !== undefined) bare.device = device;
    if (system !== undefined) bare.system = system;
    if (isPlainObject(zenso) || Object.keys(bare).length > 0) {
        top.zenso = fillMissing(isPlainObject(zenso) ? zenso : {}, bare);
    }
    const resolved = fillMissing(top, fromFiles);
    // Live clock: the backend stamps current time per render, so the mock does too.
    if (isPlainObject(resolved.zenso)) {
        if (!isPlainObject(resolved.zenso.system)) resolved.zenso.system = {};
        resolved.zenso.system.timestamp_utc = Math.floor(Date.now() / 1000);
    }
    return resolved;
}
