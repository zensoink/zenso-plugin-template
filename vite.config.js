import { defineConfig } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vituum from 'vituum'
import liquid from '@vituum/vite-plugin-liquid'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import manifest from './manifest.json' with { type: 'json' }

const __dirname = dirname(fileURLToPath(import.meta.url))

const paths = {
  src: 'src',
  dev: 'dev',
  dist: 'dist',
  cssFile: 'public/main.css',
  copyTargets: ['manifest.json', 'README.md', 'LICENSE', 'CHANGELOG.md']
}

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  const plugins = []

  if (isDev) {
    plugins.push(
      vituum({
        pages: {
          dir: `${paths.dev}/pages`,
          root: paths.src,
        },
      }),
      liquid({
        root: paths.src,
        data: [`${paths.dev}/mock/*.json`],
        globals: { manifest },
      })
    )
  }

  plugins.push(
    viteStaticCopy({
      targets: [
        { src: `${paths.src}/**/*.liquid`, dest: '.', rename: { stripBase: 1 } },
        { src: paths.copyTargets, dest: '.' }
      ]
    })
  )

  return {
    plugins,
    build: {
      outDir: paths.dist,
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, `${paths.cssFile}`),
        output: {
          assetFileNames: (assetInfo) =>
             assetInfo.originalFileName === paths.cssFile
                ? assetInfo.name
                : 'assets/[name]-[hash][extname]'
        }
      }
    },
    server: {
      open: '/'
    }
  }
})
