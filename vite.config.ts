import {defineConfig} from 'vite';
import {zensoPlugin} from '@zenso/zenso-vite-plugin';

export default defineConfig({
    plugins: [zensoPlugin({zip: true, generateMockData: true})]
});
