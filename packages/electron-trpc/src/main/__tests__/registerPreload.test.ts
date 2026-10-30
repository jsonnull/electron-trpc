import { initTRPC } from '@trpc/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { createIPCHandler } from '..';
import { ELECTRON_TRPC_CHANNEL } from '../../constants';
import { ipcMain, reset, session } from '../../__tests__/fakeElectron';

vi.mock('electron', () => import('../../__tests__/fakeElectron'));
// As in a packaged app whose build bundled electron-trpc without its preload script.
vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: () => false,
}));

const router = initTRPC.create().router({});

beforeEach(() => reset());

test('fails clearly, leaving nothing behind, when the preload script is missing', () => {
  expect(() => createIPCHandler({ router })).toThrow(/couldn't find its preload script/);

  expect(ipcMain.listenerCount(ELECTRON_TRPC_CHANNEL)).toBe(0);
  expect(session.defaultSession.registerPreloadScript).not.toHaveBeenCalled();
});

test('does not need the preload script with `preload: false`', () => {
  using handler = createIPCHandler({ router, preload: false });

  expect(handler).toBeDefined();
  expect(ipcMain.listenerCount(ELECTRON_TRPC_CHANNEL)).toBe(1);
});
