import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Pure-JS deps that are safe to bundle into out/main/index.js (no native code,
 * no dynamic require()s of files outside the package). Bundling them avoids
 * relying on electron-builder's transitive node_modules walk, which has been
 * flaky for archiver's dependency tree (zip-stream → archiver-utils
 * occasionally getting dropped).
 *
 * Native modules MUST be externalized (Electron loads .node files via dlopen,
 * not via the JS bundler).
 */
const BUNDLE_INTO_MAIN = [
  'archiver',
  'archiver-utils',
  'zip-stream',
  'compress-commons',
  'crc32-stream',
  'extract-zip',
  'pdf-lib',
  '@pdf-lib/fontkit',
  'fontkit',
  'fuse.js',
  'zod',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: BUNDLE_INTO_MAIN })],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'better-sqlite3-multiple-ciphers', '@node-rs/argon2', 'argon2', 'node-thermal-printer', 'electron-updater'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
      },
    },
  },
});
