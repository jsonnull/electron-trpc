import { _electron as electron, test, expect } from '@playwright/test';

test('Hello Electron', async () => {
  const electronApp = await electron.launch({
    args: [`${__dirname}`],
    executablePath: process.env.PLAYWRIGHT_ELECTRON_PATH ?? undefined,
  });

  const window = await electronApp.firstWindow();
  expect(await window.title()).toBe('Hello from Electron renderer!');

  const response = await window.textContent('[data-testid="greeting"]');
  expect(response).toBe('Hello Electron');

  await electronApp.close();
});
