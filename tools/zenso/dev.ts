import fs from 'node:fs';
import { Liquid } from 'liquidjs';
import {
    DEV_MAIN_SRC,
    DEV_STYLES_HREF,
    MAIN_SRC,
    MOCK_PATH,
    PACKAGE_JSON_PATH,
    TEMPLATE_SRC,
    ZENSO_CONFIG_PATH
} from './constants';
import { hasScriptCapability } from './manifest';
import { resolveMockData, syncMockSparse } from './mock';
import { injectHeadAssets } from './template';

/**
 * Vite dev plugin: renders `src/index.liquid` with the resolved mock context on `/`.
 * Watches template, mock, config and `package.json` (full-reload on change,
 * sparse mock re-sync on config change) and serves dev asset references with HMR.
 *
 * @param opts - Plugin flags.
 * @param opts.generateMockData - Whether to derive config-based mock layers
 * and sync the sparse `mock/plugin.json` (at startup, before each render,
 * and on config change). When false, only files + inline data render.
 * @param opts.mock - Inline mock data (highest precedence layer).
 * @returns The Vite plugin object.
 */
export function liquidDevPlugin(opts: { generateMockData: boolean; mock?: Record<string, any> }) {
    // ponytail: identity mapping matches the relative-path layout used in dist
    const engine = new Liquid();
    engine.registerFilter('asset_url', (value: any) => String(value));

    return {
        name: 'vite-plugin-liquid-dev',
        configureServer(server: any) {
            if (opts.generateMockData) syncMockSparse();
            server.watcher.add([TEMPLATE_SRC, MOCK_PATH, ZENSO_CONFIG_PATH, PACKAGE_JSON_PATH]);

            server.watcher.on('change', (file: string) => {
                if (opts.generateMockData && (file === ZENSO_CONFIG_PATH || file === PACKAGE_JSON_PATH)) {
                    syncMockSparse();
                }
                if (file === TEMPLATE_SRC || file === MOCK_PATH || file === ZENSO_CONFIG_PATH || file === PACKAGE_JSON_PATH) {
                    server.ws.send({ type: 'full-reload' });
                }
            });

            server.middlewares.use(async (req: any, res: any, next: any) => {
                if (req.url === '/' || req.url?.endsWith('.html')) {

                    try {
                        let template = fs.readFileSync(TEMPLATE_SRC, 'utf-8');
                        if (opts.generateMockData) syncMockSparse();
                        // Render-time merge: inline option → mock/plugin.json →
                        // mock/zenso.json → derived defaults. Nothing is written here.
                        const mockData = resolveMockData(opts.mock, opts.generateMockData);

                        template = injectHeadAssets(template, {
                            stylesHref: DEV_STYLES_HREF,
                            mainSrc: hasScriptCapability() && fs.existsSync(MAIN_SRC)
                                ? DEV_MAIN_SRC
                                : null
                        });

                        const devScripts = `<script type="module" src="/@vite/client"></script>`;

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
