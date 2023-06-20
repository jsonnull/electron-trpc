import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: path.resolve(__dirname, 'dist/main'),
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      outDir: path.resolve(__dirname, 'dist/preload'),
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/renderer/index.ts'),
        formats: ['es'],
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
        },
      },
      outDir: path.resolve(__dirname, 'dist/renderer'),
    },
  },
});
