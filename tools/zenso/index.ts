import zipPack from 'vite-plugin-zip-pack';
import type { Options as ZipOptions } from 'vite-plugin-zip-pack';
import { zensoBuildPlugin, zensoConfigPlugin } from './build';
import { OUT_DIR, ZIP_FILENAME } from './constants';
import { liquidDevPlugin } from './dev';

export { hasScriptCapability } from './manifest';

/** Options for {@link zensoPlugin}. All optional; defaults preserve template behavior. */
export interface ZensoPluginOptions {
    /**
     * Regenerate derived mock layers from `zenso.config.json` + `package.json`
     * and sync the sparse `mock/plugin.json` (dev only: at server startup,
     * before each render, and on config change).
     *
     * @defaultValue true
     */
    generateMockData?: boolean;
    /**
     * Inline mock data — the highest-precedence layer of the render-time
     * context (`mock` option → `mock/plugin.json` → `mock/zenso.json` →
     * derived defaults). Pass an object directly or spread imported JSONs.
     *
     * @example
     * ```ts
     * import zensoMock from './mock/zenso.json';
     * import pluginMock from './mock/plugin.json';
     *
     * zensoPlugin({ mock: { ...zensoMock, ...pluginMock } })
     * ```
     */
    mock?: Record<string, any>;
    /**
     * Pack `dist/` into `plugin.zip` after build. Default true.
     * Pass an object to override individual zipPack options.
     *
     * @defaultValue true
     */
    zip?: boolean | ZipOptions;
}

/**
 * The single build system for Zenso plugins: fixed `src/*` inputs and fixed
 * `dist` outputs by convention, composed as
 * dev plugin → config defaults → build emit → zip.
 * User `build` values in `vite.config.ts` merge over the plugin defaults.
 *
 * No path options exist by design — add a param only when a second real
 * project layout needs it.
 *
 * @param opts - Plugin options, see {@link ZensoPluginOptions}.
 * @returns The Vite plugin list for `defineConfig({ plugins })`.
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { zensoPlugin } from './tools/zenso/index';
 *
 * export default defineConfig({ plugins: [zensoPlugin()] });
 * ```
 */
export function zensoPlugin(opts: ZensoPluginOptions = {}) {
    const generateMockData = opts.generateMockData ?? true;

    return [
        liquidDevPlugin({ generateMockData, mock: opts.mock }),
        zensoConfigPlugin(),
        zensoBuildPlugin(),
        ...(opts.zip === false
            ? []
            : [zipPack({
                inDir: OUT_DIR,
                outDir: './',
                outFileName: ZIP_FILENAME,
                ...(typeof opts.zip === 'object' ? opts.zip : {})
            })])
    ];
}
