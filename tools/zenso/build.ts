import fs from 'node:fs';
import {
    ASSETS_DIR,
    MAIN_SRC,
    MANIFEST_FILENAME,
    OUT_DIR,
    PROD_MAIN_SRC,
    PROD_STYLES_HREF,
    STYLES_SRC,
    TEMPLATE_FILENAME,
    TEMPLATE_SRC
} from './constants';
import { buildManifestJson, hasScriptCapability } from './manifest';
import { injectHeadAssets } from './template';

/**
 * Contributes the build defaults via Vite's `config()` hook.
 * User `build` values in `vite.config.ts` merge over these automatically
 * (Vite `mergeConfig` semantics: user config wins).
 *
 * @returns The Vite plugin object. Defaults: `outDir` with `emptyOutDir`,
 * `styles` + conditional `main` rollup inputs, `assets/[name]` outputs.
 */
export function zensoConfigPlugin() {
    return {
        name: 'zenso-config',
        config() {
            return {
                build: {
                    outDir: OUT_DIR,
                    emptyOutDir: true,
                    rollupOptions: {
                        input: {
                            styles: STYLES_SRC,
                            ...(hasScriptCapability() ? { main: MAIN_SRC } : {})
                        },
                        output: {
                            entryFileNames: `${ASSETS_DIR}/[name].js`,
                            assetFileNames: `${ASSETS_DIR}/[name].[ext]`
                        }
                    }
                }
            };
        }
    };
}

/**
 * Emits the backend-facing files into the bundle: the merged `manifest.json`
 * and the production `index.liquid` (prod asset references injected).
 * The `script` capability is captured once at plugin creation.
 *
 * @returns The Vite plugin object.
 */
export function zensoBuildPlugin() {
    const allowJavaScript = hasScriptCapability();
    return {
        name: 'zenso-plugin-build',
        generateBundle(this: any) {
            this.emitFile({
                type: 'asset',
                fileName: MANIFEST_FILENAME,
                source: JSON.stringify(buildManifestJson(), null, 2)
            });
            this.emitFile({
                type: 'asset',
                fileName: TEMPLATE_FILENAME,
                source: injectHeadAssets(
                    fs.readFileSync(TEMPLATE_SRC, 'utf-8'),
                    { stylesHref: PROD_STYLES_HREF, mainSrc: allowJavaScript ? PROD_MAIN_SRC : null }
                )
            });
        }
    };
}
