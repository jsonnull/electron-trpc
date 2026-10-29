import { _electron as electron, test, expect } from '@playwright/test';

test('Hello Electron with superjson', async () => {
  const electronApp = await electron.launch({
    args: [`${__dirname}`],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('load');
  await expect(window.getByTestId('greeting')).toHaveText('Hello Electron');
  await expect(window.getByTestId('greeted-year')).toHaveText(String(new Date().getFullYear()));

  await electronApp.close();
});
