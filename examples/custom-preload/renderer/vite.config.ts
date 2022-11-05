import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      external: ['electron', 'path'],
    },
  },
  plugins: [renderer(), react()],
});
