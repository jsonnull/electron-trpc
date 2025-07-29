import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { BrowserWindow, ipcMain, IpcMainEvent, WebContents, WebFrameMain, session } from 'electron';
import { createIPCHandler } from '../createIPCHandler';
import { ELECTRON_TRPC_CHANNEL } from '../../constants';
import { ETRPCRequest } from '../../types';
import { handleIPCMessage } from '../handleIPCMessage';
import { initTRPC } from '@trpc/server';

vi.mock('../handleIPCMessage', () => ({
  handleIPCMessage: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn(),
  },
  session: {
    defaultSession: {
      getPreloads: vi.fn(() => []),
      setPreloads: vi.fn(),
    },
  },
}));

interface MockWebContents {
  id: number;
  on: MockedFunction<(event: string, handler: any) => void>;
  isDestroyed: () => boolean;
}

interface MockWebFrameMain {
  routingId: number;
}

interface MockBrowserWindow {
  id: number;
  webContents: MockWebContents;
  isDestroyed: () => boolean;
}

interface MockIpcMainEvent {
  sender: MockWebContents & { id: number };
  senderFrame: MockWebFrameMain;
  reply: MockedFunction<(channel: string, ...args: any[]) => void>;
}

const makeBrowserWindow = (window: MockBrowserWindow) => window as unknown as BrowserWindow;
const makeIpcMainEvent = (event: MockIpcMainEvent) => event as unknown as IpcMainEvent;

describe('IPCHandler', () => {
  let mockHandleIPCMessage: MockedFunction<typeof handleIPCMessage>;
  let ipcMainHandler: ((event: IpcMainEvent, request: ETRPCRequest) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleIPCMessage = vi.mocked(handleIPCMessage);
    ipcMainHandler = undefined;

    vi.mocked(ipcMain.on).mockImplementation((channel, handler) => {
      if (channel === ELECTRON_TRPC_CHANNEL) {
        ipcMainHandler = handler;
      }
      return ipcMain;
    });
  });

  describe('constructor', () => {
    it('should register ipcMain handler', () => {
      const t = initTRPC.create();
      const router = t.router({});

      createIPCHandler({ router });

      expect(ipcMain.on).toHaveBeenCalledWith(ELECTRON_TRPC_CHANNEL, expect.any(Function));
    });

    it('should attach initial windows', () => {
      const t = initTRPC.create();
      const router = t.router({});

      const mockWindow1: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      const mockWindow2: MockBrowserWindow = {
        id: 2,
        webContents: {
          id: 102,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      createIPCHandler({
        router,
        windows: [makeBrowserWindow(mockWindow1), makeBrowserWindow(mockWindow2)],
      });

      expect(mockWindow1.webContents.on).toHaveBeenCalledWith(
        'did-start-navigation',
        expect.any(Function)
      );
      expect(mockWindow1.webContents.on).toHaveBeenCalledWith('destroyed', expect.any(Function));
      expect(mockWindow2.webContents.on).toHaveBeenCalledWith(
        'did-start-navigation',
        expect.any(Function)
      );
      expect(mockWindow2.webContents.on).toHaveBeenCalledWith('destroyed', expect.any(Function));
    });

    it('should pass createContext to handleIPCMessage', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const createContext = vi.fn().mockResolvedValue({ user: 'test' });

      createIPCHandler({ router, createContext });

      const mockEvent: MockIpcMainEvent = {
        sender: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        senderFrame: {
          routingId: 1,
        },
        reply: vi.fn(),
      };

      const request: ETRPCRequest = {
        method: 'request',
        operation: {
          id: 1,
          type: 'query',
          path: 'test.query',
          input: undefined,
          context: {},
        },
      };

      ipcMainHandler?.(makeIpcMainEvent(mockEvent), request);

      expect(mockHandleIPCMessage).toHaveBeenCalledWith({
        router,
        createContext,
        internalId: '101-1:1',
        event: expect.any(Object),
        message: request,
        subscriptions: expect.any(Map),
      });
    });
  });

  describe('attachWindow', () => {
    it('should attach a new window', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      handler.attachWindow(makeBrowserWindow(mockWindow));

      expect(mockWindow.webContents.on).toHaveBeenCalledWith(
        'did-start-navigation',
        expect.any(Function)
      );
      expect(mockWindow.webContents.on).toHaveBeenCalledWith('destroyed', expect.any(Function));
    });

    it('should not attach the same window twice', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      const browserWindow = makeBrowserWindow(mockWindow);
      handler.attachWindow(browserWindow);
      handler.attachWindow(browserWindow);

      expect(mockWindow.webContents.on).toHaveBeenCalledTimes(2);
    });
  });

  describe('detachWindow', () => {
    it('should detach a window and clean up subscriptions', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      const browserWindow = makeBrowserWindow(mockWindow);
      handler.attachWindow(browserWindow);

      const subscriptions = (handler as any)['subscriptions'] as Map<string, any>;
      const mockUnsubscribe = vi.fn();
      subscriptions.set('101-1:subscription1', { unsubscribe: mockUnsubscribe });
      subscriptions.set('102-1:subscription2', { unsubscribe: vi.fn() });

      handler.detachWindow(browserWindow);

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscriptions.has('101-1:subscription1')).toBe(false);
      expect(subscriptions.has('102-1:subscription2')).toBe(true);
    });

    it('should throw error when detaching destroyed window without webContentsId', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        isDestroyed: () => true,
      };

      const browserWindow = makeBrowserWindow(mockWindow);

      expect(() => handler.detachWindow(browserWindow)).toThrow(
        'webContentsId is required when calling detachWindow on a destroyed window'
      );
    });

    it('should allow detaching destroyed window with webContentsId', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        isDestroyed: () => true,
      };

      const browserWindow = makeBrowserWindow(mockWindow);
      handler.attachWindow(browserWindow);

      expect(() => handler.detachWindow(browserWindow, 101)).not.toThrow();
    });
  });

  describe('subscription cleanup handlers', () => {
    it('should clean up subscriptions on hard navigation', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      let navigationHandler: ((event: any) => void) | undefined;
      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn().mockImplementation((event, handler) => {
            if (event === 'did-start-navigation') {
              navigationHandler = handler;
            }
          }),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      handler.attachWindow(makeBrowserWindow(mockWindow));

      const subscriptions = (handler as any)['subscriptions'] as Map<string, any>;
      const mockUnsubscribe1 = vi.fn();
      const mockUnsubscribe2 = vi.fn();
      const mockUnsubscribe3 = vi.fn();

      subscriptions.set('101-1:subscription1', { unsubscribe: mockUnsubscribe1 });
      subscriptions.set('101-2:subscription2', { unsubscribe: mockUnsubscribe2 });
      subscriptions.set('102-1:subscription3', { unsubscribe: mockUnsubscribe3 });

      navigationHandler?.({
        isSameDocument: false,
        frame: { routingId: 1 },
      });

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).not.toHaveBeenCalled();
      expect(mockUnsubscribe3).not.toHaveBeenCalled();
      expect(subscriptions.has('101-1:subscription1')).toBe(false);
      expect(subscriptions.has('101-2:subscription2')).toBe(true);
      expect(subscriptions.has('102-1:subscription3')).toBe(true);
    });

    it('should not clean up subscriptions on soft navigation', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      let navigationHandler: ((event: any) => void) | undefined;
      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn().mockImplementation((event, handler) => {
            if (event === 'did-start-navigation') {
              navigationHandler = handler;
            }
          }),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      handler.attachWindow(makeBrowserWindow(mockWindow));

      const subscriptions = (handler as any)['subscriptions'] as Map<string, any>;
      const mockUnsubscribe = vi.fn();
      subscriptions.set('101-1:subscription1', { unsubscribe: mockUnsubscribe });

      navigationHandler?.({
        isSameDocument: true,
        frame: { routingId: 1 },
      });

      expect(mockUnsubscribe).not.toHaveBeenCalled();
      expect(subscriptions.has('101-1:subscription1')).toBe(true);
    });

    it('should detach window on webContents destroyed event', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      const eventHandlers: { [key: string]: (() => void)[] } = {
        destroyed: [],
        'did-start-navigation': [],
      };

      const mockWindow: MockBrowserWindow = {
        id: 1,
        webContents: {
          id: 101,
          on: vi.fn().mockImplementation((event, handler) => {
            eventHandlers[event].push(handler);
          }),
          isDestroyed: () => false,
        },
        isDestroyed: () => false,
      };

      const browserWindow = makeBrowserWindow(mockWindow);
      handler.attachWindow(browserWindow);

      const subscriptions = (handler as any)['subscriptions'] as Map<string, any>;
      const mockUnsubscribe1 = vi.fn();
      const mockUnsubscribe2 = vi.fn();
      const mockUnsubscribe3 = vi.fn();

      subscriptions.set('101-1:subscription1', { unsubscribe: mockUnsubscribe1 });
      subscriptions.set('101-2:subscription2', { unsubscribe: mockUnsubscribe2 });
      subscriptions.set('102-1:subscription3', { unsubscribe: mockUnsubscribe3 });

      expect((handler as any)['windows']).toHaveLength(1);

      mockWindow.isDestroyed = () => true;

      expect(eventHandlers.destroyed).toHaveLength(1);
      eventHandlers.destroyed.forEach((handler) => handler());

      expect((handler as any)['windows']).toHaveLength(0);

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).toHaveBeenCalled();
      expect(mockUnsubscribe3).not.toHaveBeenCalled(); // Different webContentsId
      expect(subscriptions.has('101-1:subscription1')).toBe(false);
      expect(subscriptions.has('101-2:subscription2')).toBe(false);
      expect(subscriptions.has('102-1:subscription3')).toBe(true);
    });
  });

  describe('IPC message handling', () => {
    it('should handle request messages', () => {
      const t = initTRPC.create();
      const router = t.router({});
      createIPCHandler({ router });

      const mockEvent: MockIpcMainEvent = {
        sender: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        senderFrame: {
          routingId: 1,
        },
        reply: vi.fn(),
      };

      const request: ETRPCRequest = {
        method: 'request',
        operation: {
          id: 1,
          type: 'query',
          path: 'test.query',
          input: undefined,
          context: {},
        },
      };

      ipcMainHandler?.(makeIpcMainEvent(mockEvent), request);

      expect(mockHandleIPCMessage).toHaveBeenCalledOnce();
      expect(mockHandleIPCMessage).toHaveBeenCalledWith({
        router,
        createContext: undefined,
        internalId: '101-1:1',
        event: expect.any(Object),
        message: request,
        subscriptions: expect.any(Map),
      });
    });

    it('should handle subscription.stop messages', () => {
      const t = initTRPC.create();
      const router = t.router({});
      createIPCHandler({ router });

      const mockEvent: MockIpcMainEvent = {
        sender: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        senderFrame: {
          routingId: 1,
        },
        reply: vi.fn(),
      };

      const request: ETRPCRequest = {
        method: 'subscription.stop',
        id: 1,
      };

      ipcMainHandler?.(makeIpcMainEvent(mockEvent), request);

      expect(mockHandleIPCMessage).toHaveBeenCalledWith({
        router,
        createContext: undefined,
        internalId: '101-1:1',
        event: expect.any(Object),
        message: request,
        subscriptions: expect.any(Map),
      });
    });

    it('should share subscriptions map across all IPC messages', () => {
      const t = initTRPC.create();
      const router = t.router({});
      const handler = createIPCHandler({ router });

      const subscriptions = (handler as any)['subscriptions'] as Map<string, any>;
      subscriptions.set('test-subscription', { unsubscribe: vi.fn() });

      const mockEvent: MockIpcMainEvent = {
        sender: {
          id: 101,
          on: vi.fn(),
          isDestroyed: () => false,
        },
        senderFrame: {
          routingId: 1,
        },
        reply: vi.fn(),
      };

      const request: ETRPCRequest = {
        method: 'request',
        operation: {
          id: 1,
          type: 'query',
          path: 'test.query',
          input: undefined,
          context: {},
        },
      };

      ipcMainHandler?.(makeIpcMainEvent(mockEvent), request);

      const passedSubscriptions = mockHandleIPCMessage.mock.calls[0][0].subscriptions;
      expect(passedSubscriptions.has('test-subscription')).toBe(true);
    });
  });

  describe('autoRegisterPreload', () => {
    it('should auto-register preload script by default', () => {
      const t = initTRPC.create();
      const router = t.router({});

      // Mock existing preloads
      const existingPreloads = ['/path/to/existing/preload.js'];
      vi.mocked(session.defaultSession.getPreloads).mockReturnValue(existingPreloads);

      createIPCHandler({ router });

      expect(vi.mocked(session.defaultSession.getPreloads)).toHaveBeenCalled();
      expect(vi.mocked(session.defaultSession.setPreloads)).toHaveBeenCalledWith([
        ...existingPreloads,
        expect.stringContaining('electron-trpc/dist/preload-auto'),
      ]);
    });

    it('should not register preload script when autoRegisterPreload is false', () => {
      const t = initTRPC.create();
      const router = t.router({});

      createIPCHandler({ router, autoRegisterPreload: false });

      expect(vi.mocked(session.defaultSession.getPreloads)).not.toHaveBeenCalled();
      expect(vi.mocked(session.defaultSession.setPreloads)).not.toHaveBeenCalled();
    });
  });
});
