import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import path from 'node:path';
import url from 'node:url';
import json from '@rollup/plugin-json';

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = 'com.mesos.blueskygolive.sdPlugin';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
    input: 'src/plugin.ts',
    output: {
        file: `${sdPlugin}/bin/plugin.js`,
        sourcemap: isWatching,
        sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
            return url.pathToFileURL(
                path.resolve(path.dirname(sourcemapPath), relativeSourcePath),
            ).href;
        },
    },
    external: ['sharp', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
    plugins: [
        {
            name: 'watch-externals',
            buildStart: function () {
                this.addWatchFile(`${sdPlugin}/manifest.json`);
            },
        },
        typescript({
            mapRoot: isWatching ? './' : undefined,
        }),
        nodeResolve({
            browser: false,
            exportConditions: ['node'],
            preferBuiltins: true,
        }),
        commonjs(),
        json(),
        !isWatching && terser(),
        {
            name: 'inject-dirname-shim',
            renderChunk(code) {
                const shim = `import { fileURLToPath as __sd_furl } from 'url';\nimport { dirname as __sd_dir } from 'path';\nvar __filename = __sd_furl(import.meta.url);\nvar __dirname = __sd_dir(__filename);\n`;
                return shim + code;
            },
        },
        {
            name: 'emit-module-package-file',
            generateBundle() {
                this.emitFile({
                    fileName: 'package.json',
                    source: `{ "type": "module" }`,
                    type: 'asset',
                });
            },
        },
    ],
};

export default config;
