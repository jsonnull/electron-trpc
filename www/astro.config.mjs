import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://electron-trpc.dev',
  integrations: [
    starlight({
      title: 'electron-trpc',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/jsonnull/electron-trpc' },
      ],
      sidebar: [
        'getting-started',
        { label: 'Guides', items: ['preload-script', 'request-lifetimes', 'security'] },
        'upgrading',
      ],
    }),
  ],
});
