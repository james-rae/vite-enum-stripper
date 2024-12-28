import path from 'path';
import { defineConfig } from 'vite';
import packageJson from './package.json';
import { enumStripperPlugin } from './vite.enum.plugin';

export default defineConfig({
    base: './',
    build: {
        outDir: './build',
        rollupOptions: {
            output: {
                entryFileNames: `assets/${packageJson.name}.js`,
                assetFileNames: `assets/${packageJson.name}.css`
            }
        },
        sourcemap: true
    },
    plugins: [enumStripperPlugin()], // <-- right here, eh!
    resolve: {
        alias: [
            { find: '@', replacement: path.resolve(__dirname, 'src') },
            { find: '@@', replacement: path.resolve(__dirname) }
        ]
    }
});
