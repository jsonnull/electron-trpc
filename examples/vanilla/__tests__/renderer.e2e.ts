import { _electron as electron, test, expect } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';

let electronApp: ElectronApplication;

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: [`${__dirname}/../`] });
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('query', () => {
  test('should load greeting when page loads', async () => {
    const window = await electronApp.firstWindow();
    expect(await window.title()).toBe('Hello from Electron renderer!');

    const response = await window.textContent('[data-testid="greeting"]');
    expect(response).toBe('Hello Electron');
  });
});

test.describe('multiple windows', () => {
  test('should increment counter when button is clicked', async () => {
    const [window1, window2] = electronApp.windows();

    // increment counter in window 1
    await window1.click('[data-testid="increment-btn"]');

    // check that counter is incremented in window 1
    expect(await window1.textContent('[data-testid="count-p"]')).toBe('1');

    // check that counter is incremented in window 2
    expect(await window2.textContent('[data-testid="count-p"]')).toBe('1');
  });
});
