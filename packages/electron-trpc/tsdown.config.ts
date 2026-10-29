import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: {
      main: 'src/main/index.ts',
      preload: 'src/preload/index.ts',
      renderer: 'src/renderer/index.ts',
    },
    format: ['esm', 'cjs'],
    platform: 'node',
    dts: true,
    clean: true,
  },
  {
    // Registered as a session preload, which may run sandboxed. Sandboxed preloads can only
    // `require('electron')`, so everything else has to be bundled into this one file.
    entry: { 'preload-auto': 'src/preload/autoPreload.ts' },
    format: 'cjs',
    platform: 'node',
    dts: false,
    clean: false,
    deps: { onlyImport: ['electron'] },
  },
]);
