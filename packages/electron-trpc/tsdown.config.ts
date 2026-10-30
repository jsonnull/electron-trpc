import { defineConfig } from 'tsdown';

// Lower newer syntax such as `using` declarations, so consumers bundling this don't have to parse it.
const target = 'es2022';

export default defineConfig([
  {
    entry: {
      main: 'src/main/index.ts',
      preload: 'src/preload/index.ts',
      renderer: 'src/renderer/index.ts',
    },
    format: ['esm', 'cjs'],
    platform: 'node',
    target,
    dts: { generator: 'oxc' },
    // Our types use `Disposable`, which consumers only have with `esnext.disposable` in their `lib`.
    banner: { dts: '/// <reference lib="esnext.disposable" />' },
    clean: true,
  },
  {
    // Registered as a session preload, which may run sandboxed. Sandboxed preloads can only
    // `require('electron')`, so everything else has to be bundled into this one file.
    entry: { 'preload-auto': 'src/preload/autoPreload.ts' },
    format: 'cjs',
    platform: 'node',
    target,
    dts: false,
    clean: false,
    deps: { onlyImport: ['electron'] },
  },
]);
