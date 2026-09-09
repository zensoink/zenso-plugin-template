import {defineConfig} from 'vite';
import {zensoPlugin} from './tools/zenso';

export default defineConfig({
    plugins: [zensoPlugin({zip: true, generateMockData: true})]
});
