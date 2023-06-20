import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      watch: {
        include: ['src/main/**/*'],
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      watch: {
        include: ['src/renderer/**/*'],
      },
      rollupOptions: {
        input: path.resolve(__dirname, 'src/renderer/index.ts'),
      },
      lib: {
        entry: path.resolve(__dirname, 'src/renderer/index.ts'),
        formats: ['es'],
        fileName: 'index',
      },
      outDir: path.resolve(__dirname, 'out/renderer'),
    },
  },
});
