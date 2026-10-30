import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, test, expect } from '@playwright/test';

test('Hello Electron, packaged with webpack', async () => {
  // Packaged webpack apps, like electron-forge's, ship only the webpack output.
  const app = mkdtempSync(path.join(tmpdir(), 'electron-trpc-webpack-'));
  cpSync(path.join(__dirname, '.webpack'), path.join(app, '.webpack'), { recursive: true });
  cpSync(path.join(__dirname, 'package.json'), path.join(app, 'package.json'));

  const electronApp = await electron.launch({
    args: [app],
    executablePath: require('electron') as unknown as string,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('load');
  expect(await window.title()).toBe('Hello from Electron renderer!');
  await expect(window.getByTestId('greeting')).toHaveText('Hello Electron');

  await electronApp.close();
});
