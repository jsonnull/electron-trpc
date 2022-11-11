import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/index.ts',
      },
      {
        entry: 'preload/preload.ts',
        onstart(options) {
          options.reload();
        },
      },
    ]),
  ],
});
