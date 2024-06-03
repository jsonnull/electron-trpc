import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://electron-trpc.dev',
  integrations: [
    starlight({
      title: 'electron-trpc',
      social: {
        github: 'https://github.com/jsonnull/electron-trpc',
      },
    }),
  ],
});
