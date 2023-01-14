import { defineConfig } from 'vitepress';
import UnoCSS from 'unocss/vite';

export default defineConfig({
  title: 'electron-trpc',
  description: 'Just playing around.',
  themeConfig: {
    repo: 'jsonnull/electron-trpc',
    nav: [{ text: 'Guide', link: '/getting-started' }],
    sidebar: [
      {
        text: 'Guide',
        items: [{ text: 'Getting Started', link: '/getting-started' }],
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2023-present Jason Nall',
    },
  },
  vite: {
    plugins: [UnoCSS({})],
  },
});
