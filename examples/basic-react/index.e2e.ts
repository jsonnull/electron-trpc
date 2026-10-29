import { _electron as electron, test, expect } from '@playwright/test';

test('Hello Electron', async () => {
  const electronApp = await electron.launch({
    args: [`${__dirname}`],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('load');
  expect(await window.title()).toBe('Hello from Electron renderer!');
  await expect(window.getByTestId('greeting')).toHaveText('Hello Electron');

  // Subscribe, then trigger an event from the main process.
  await window.getByTestId('greet').click();
  await expect(window.getByTestId('greetings')).toHaveText('Greeted Electron');
  await expect(window.getByTestId('subscribers')).toHaveText('Subscribers: 1');

  // Reloading replaces the document, which has to end its subscription in the main process.
  await window.reload();
  await window.getByTestId('greet').click();
  await expect(window.getByTestId('greetings')).toHaveText('Greeted Electron');
  await expect(window.getByTestId('subscribers')).toHaveText('Subscribers: 1');

  await electronApp.close();
});
