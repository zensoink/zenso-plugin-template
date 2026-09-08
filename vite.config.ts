import { defineConfig } from 'vite';
import { Liquid } from 'liquidjs';
import zipPack from 'vite-plugin-zip-pack';
import fs from 'node:fs';
import path from 'node:path';

const engine = new Liquid();
// ponytail: identity mapping matches the relative-path layout used in dist
engine.registerFilter('asset_url', (value: any) => String(value));

// Single place to configure asset paths: dev serves source files with HMR, build uses bundled output
const DEV_STYLES_HREF = '/src/styles.css';
const PROD_STYLES_HREF = 'assets/styles.css';
const DEV_MAIN_SRC = '/src/main.ts';
const PROD_MAIN_SRC = 'assets/main.js';

function injectHeadAssets(html: string, opts: { stylesHref: string; mainSrc: string | null }): string {
    const tags = [`<link rel="stylesheet" href="${opts.stylesHref}">`];
    if (opts.mainSrc) tags.push(`<script type="module" src="${opts.mainSrc}"></script>`);
    const injection = tags.join('\n');
    if (html.includes('</head>')) return html.replace('</head>', `${injection}\n</head>`);
    return `${html}\n${injection}`;
}

function hasScriptCapability(): boolean {
    try {
        const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'zenso.config.json'), 'utf-8'));
        return Array.isArray(cfg.capabilities) && cfg.capabilities.includes('script');
    } catch {
        return false;
    }
}
const ALLOW_JAVASCRIPT = hasScriptCapability();

const DEFAULT_ZENSO_MOCK = {
    user: {
        id: 'user_123',
        name: 'Tytus Bomba',
        first_name: 'Tytus',
        locale: 'pl-PL',
        language: 'pl',
        time_zone_iana: 'Europe/Warsaw',
        utc_offset: 7200
    },
    device: {
        id: 'spectra-13.3',
        friendly_id: 'AB12CD',
        width: 1600,
        height: 1200,
        orientation: 'landscape'
    },
    system: {
        timestamp_utc: 1778317800,
        core_version: '0.0.0',
        firmware_version: '0.0.0'
    }
};

function isPlainObject(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ponytail: shallow-path fill only, deep-merge for plain objects; arrays are treated as atomic values
function fillMissing(target: Record<string, any>, defaults: Record<string, any>): Record<string, any> {
    for (const [key, value] of Object.entries(defaults)) {
        if (target[key] === undefined) {
            target[key] = value;
        } else if (isPlainObject(value) && isPlainObject(target[key])) {
            fillMissing(target[key], value);
        }
    }
    return target;
}

function buildPluginMock(zensoConfig: any): Record<string, any> {
    let pkg: any = {};
    try {
        pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
    } catch {
        pkg = {};
    }
    const plugin: Record<string, any> = {};
    if (zensoConfig.id !== undefined) plugin.id = zensoConfig.id;
    for (const key of ['name', 'version', 'author', 'description']) {
        if (pkg[key] !== undefined) plugin[key] = pkg[key];
    }
    return plugin;
}

function buildConfigMock(properties: any): Record<string, any> {
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

function buildDataMock(dataSources: any): Record<string, any> {
    const data: Record<string, any> = {};
    if (Array.isArray(dataSources)) {
        dataSources.forEach((ds: any) => {
            if (ds?.id) data[ds.id] = { type: ds.type, config: ds.config };
        });
    }
    return data;
}

function syncMockData() {
    const zensoConfigPath = path.resolve(__dirname, 'zenso.config.json');
    const mockPath = path.resolve(__dirname, 'mock-data.json');

    if (!fs.existsSync(zensoConfigPath)) return;
    const zensoConfig = JSON.parse(fs.readFileSync(zensoConfigPath, 'utf-8'));

    let existing: Record<string, any> = {};
    if (fs.existsSync(mockPath)) {
        try {
            existing = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
        } catch {
            existing = {};
        }
    }
    if (!isPlainObject(existing)) existing = {};

    const pluginDefaults = buildPluginMock(zensoConfig);
    const configDefaults = buildConfigMock(zensoConfig.config_schema?.properties);
    const dataDefaults = buildDataMock(zensoConfig.data_sources);

    const asObject = (v: unknown): Record<string, any> => (isPlainObject(v) ? v : {});
    // One-time migration from previous `manifest` scope name (id only;
    // name/version/author/description now come from package.json)
    const pluginSeed = asObject(existing.plugin);
    if (pluginSeed.id === undefined && isPlainObject(existing.manifest)) {
        const oldId = (existing.manifest as Record<string, any>).id;
        if (oldId !== undefined) pluginSeed.id = oldId;
    }
    const configSeed = asObject(existing.config);
    const dataSeed = asObject(existing.data);
    const zensoSeed = asObject(existing.zenso);

    // One-time migration from previous flat shape (top-level config keys / data-source keys)
    for (const key of Object.keys(configDefaults)) {
        if (configSeed[key] === undefined && (existing as Record<string, any>)[key] !== undefined) {
            configSeed[key] = (existing as Record<string, any>)[key];
        }
    }
    for (const key of Object.keys(dataDefaults)) {
        if (dataSeed[key] === undefined && (existing as Record<string, any>)[key] !== undefined) {
            dataSeed[key] = (existing as Record<string, any>)[key];
        }
    }

    const consumed = new Set([...Object.keys(configDefaults), ...Object.keys(dataDefaults), 'manifest']);
    const merged: Record<string, any> = {
        zenso: fillMissing(zensoSeed, DEFAULT_ZENSO_MOCK),
        plugin: fillMissing(pluginSeed, pluginDefaults),
        config: fillMissing(configSeed, configDefaults),
        data: fillMissing(dataSeed, dataDefaults)
    };
    for (const [key, value] of Object.entries(existing)) {
        if (!(key in merged) && !consumed.has(key)) (merged as Record<string, any>)[key] = value;
    }

    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
        fs.writeFileSync(mockPath, JSON.stringify(merged, null, 2), 'utf-8');
    }
}

function buildManifestJson(): Record<string, any> {
    const zensoConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'zenso.config.json'), 'utf-8'));
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
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

function zensoBuildPlugin() {
    return {
        name: 'zenso-plugin-build',
        generateBundle(this: any) {
            this.emitFile({
                type: 'asset',
                fileName: 'manifest.json',
                source: JSON.stringify(buildManifestJson(), null, 2)
            });
            this.emitFile({
                type: 'asset',
                fileName: 'index.liquid',
                source: injectHeadAssets(
                    fs.readFileSync(path.resolve(__dirname, 'templates/index.liquid'), 'utf-8'),
                    { stylesHref: PROD_STYLES_HREF, mainSrc: ALLOW_JAVASCRIPT ? PROD_MAIN_SRC : null }
                )
            });
        }
    };
}

syncMockData();

function liquidDevPlugin() {
    return {
        name: 'vite-plugin-liquid-dev',
        configureServer(server: any) {
            const templatesDir = path.resolve(__dirname, 'templates');
            const mockDataPath = path.resolve(__dirname, 'mock-data.json');
            const configPath = path.resolve(__dirname, 'zenso.config.json');
            const pkgPath = path.resolve(__dirname, 'package.json');

            server.watcher.add([templatesDir, mockDataPath, configPath, pkgPath]);

            server.watcher.on('change', (file: string) => {
                if (file === configPath || file === pkgPath) {
                    syncMockData();
                }
                if (file.startsWith(templatesDir) || file === mockDataPath || file === configPath || file === pkgPath) {
                    server.ws.send({ type: 'full-reload' });
                }
            });

            server.middlewares.use(async (req: any, res: any, next: any) => {
                if (req.url === '/' || req.url?.endsWith('.html')) {
                    const templatePath = path.resolve(__dirname, 'templates/index.liquid');

                    try {
                        let template = fs.readFileSync(templatePath, 'utf-8');
                        syncMockData();
                        const mockData = fs.existsSync(mockDataPath)
                            ? JSON.parse(fs.readFileSync(mockDataPath, 'utf-8'))
                            : {};

                        template = injectHeadAssets(template, {
                            stylesHref: DEV_STYLES_HREF,
                            mainSrc: hasScriptCapability() && fs.existsSync(path.resolve(__dirname, 'src/main.ts'))
                                ? DEV_MAIN_SRC
                                : null
                        });

                        let devScripts = `<script type="module" src="/@vite/client"></script>`;

                        if (template.includes('</head>')) {
                            template = template.replace('</head>', `${devScripts}\n</head>`);
                        } else {
                            template += devScripts;
                        }

                        const rendered = await engine.parseAndRender(template, mockData);
                        res.setHeader('Content-Type', 'text/html');
                        return res.end(rendered);
                    } catch (e: any) {
                        console.error("Error rendering liquid template:", e);
                        res.statusCode = 500;
                        return res.end(`<h1>Template Error</h1><pre>${e.message}</pre>`);
                    }
                }
                next();
            });
        }
    };
}

export default defineConfig({
    plugins: [
        liquidDevPlugin(),
        zensoBuildPlugin(),
        zipPack({
            inDir: 'dist',
            outDir: './',
            outFileName: 'plugin.zip'
        })
    ],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                styles: 'src/styles.css',
                ...(ALLOW_JAVASCRIPT ? { main: 'src/main.ts' } : {})
            },
            output: {
                entryFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        }
    }
});
