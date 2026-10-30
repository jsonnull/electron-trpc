import { beforeEach, expect, test, vi } from 'vitest';
import { exposeElectronTRPC } from '../exposeElectronTRPC';
import { ELECTRON_TRPC_CHANNEL } from '../../constants';
import type { ETRPCResponse, RendererGlobalElectronTRPC } from '../../types';
import { contextBridge, ipcRenderer, reset } from '../../__tests__/fakeElectron';

vi.mock('electron', () => import('../../__tests__/fakeElectron'));

const expose = () => {
  exposeElectronTRPC();
  expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('electronTRPC', expect.any(Object));
  return contextBridge.exposeInMainWorld.mock.calls[0][1] as RendererGlobalElectronTRPC;
};

beforeEach(() => reset());

test('sends requests on the electron-trpc channel', () => {
  const electronTRPC = expose();
  const request = { method: 'stop', clientId: 'client', id: 1 } as const;

  electronTRPC.sendMessage(request);

  expect(ipcRenderer.send).toHaveBeenCalledWith(ELECTRON_TRPC_CHANNEL, request);
});

test('forwards responses until the listener is removed', () => {
  const electronTRPC = expose();
  const callback = vi.fn();
  const response: ETRPCResponse = {
    clientId: 'client',
    message: { id: 1, result: { type: 'started' } },
  };

  const removeListener = electronTRPC.onMessage(callback);
  ipcRenderer.emit(ELECTRON_TRPC_CHANNEL, {}, response);
  removeListener();
  ipcRenderer.emit(ELECTRON_TRPC_CHANNEL, {}, response);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(response);
  expect(ipcRenderer.listenerCount(ELECTRON_TRPC_CHANNEL)).toBe(0);
});
