import path from 'path';
import { defineConfig } from 'vite';
import commonJSExternals from 'vite-plugin-commonjs-externals';
import builtinModules from 'builtin-modules';

module.exports = defineConfig({
  base: './',
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'electron-trpc',
      formats: ['es', 'cjs'],
      fileName: (format) => ({ es: 'index.mjs', cjs: 'index.cjs' }[format as 'es' | 'cjs']),
    },
  },
  plugins: [
    {
      ...commonJSExternals({ externals: [...builtinModules] }),
      apply: 'build',
    },
  ],
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
