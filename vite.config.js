import vituum from 'vituum'
import liquid from '@vituum/vite-plugin-liquid'


export default {
  plugins: [
    vituum(),
    liquid({
      root: './src',
      data: ['./src/mock/*.json', './manifest.json'],
    }),
  ],
}
