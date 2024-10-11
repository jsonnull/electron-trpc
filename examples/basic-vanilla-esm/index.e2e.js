import { _electron as electron, test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

test('Hello Electron', async () => {
  const electronApp = await electron.launch({
    args: [dirname],
    executablePath: process.env.PLAYWRIGHT_ELECTRON_PATH || undefined,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  const window = await electronApp.firstWindow();
  expect(await window.title()).toBe('Hello from Electron renderer!');

  const response = await window.textContent('[data-testid="greeting"]');
  expect(response).toBe('Hello Electron');

  await electronApp.close();
});
