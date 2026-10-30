/**
 * Just enough of Electron to run the main and renderer halves of electron-trpc against each other.
 * Messages are structured-cloned and delivered on a later task, like real IPC.
 */
import { EventEmitter } from 'node:events';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import type { ETRPCRequest, ETRPCResponse, RendererGlobalElectronTRPC } from '../types';

let nextId = 1;
const framesByRoutingId = new Map<string, FakeFrame>();

const deliver = (fn: () => void) => setTimeout(fn, 0);

/** Waits for every message sent so far, and the work it triggers, to be delivered. */
export const flush = async (rounds = 5) => {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

export const ipcMain = new EventEmitter();

export class FakeSession {
  readonly preloads = new Map<string, string>();
  readonly registerPreloadScript = vi.fn(({ filePath }: { filePath: string }) => {
    const id = `preload-${nextId++}`;
    this.preloads.set(id, filePath);
    return id;
  });
  readonly unregisterPreloadScript = vi.fn((id: string) => {
    this.preloads.delete(id);
  });
}

export const session = { defaultSession: new FakeSession() };

export const webFrameMain = {
  fromId: (processId: number, routingId: number) =>
    framesByRoutingId.get(`${processId}:${routingId}`),
};

export const ipcRenderer: EventEmitter & { send: Mock } = Object.assign(new EventEmitter(), {
  send: vi.fn(),
});
export const contextBridge: { exposeInMainWorld: Mock } = { exposeInMainWorld: vi.fn() };

/** One page loaded in a frame, with the `electronTRPC` global the preload script would expose. */
export class FakeDocument {
  readonly #listeners = new Set<(response: ETRPCResponse) => void>();
  readonly electronTRPC: RendererGlobalElectronTRPC;
  alive = true;

  constructor(readonly frame: FakeFrame) {
    this.electronTRPC = {
      sendMessage: (request: ETRPCRequest) => {
        if (!this.alive) return;
        const message = structuredClone(request);
        deliver(() => frame.receiveFromDocument(this, message));
      },
      onMessage: (callback) => {
        this.#listeners.add(callback);
        return () => {
          this.#listeners.delete(callback);
        };
      },
    };
  }

  get listenerCount(): number {
    return this.#listeners.size;
  }

  receive(response: ETRPCResponse) {
    if (!this.alive) return;
    for (const listener of [...this.#listeners]) listener(response);
  }

  /** Runs `fn` with this document's `electronTRPC` as the global, e.g. to create a client. */
  run<T>(fn: () => T): T {
    const global = globalThis as { electronTRPC?: RendererGlobalElectronTRPC };
    const previous = global.electronTRPC;
    global.electronTRPC = this.electronTRPC;
    try {
      return fn();
    } finally {
      global.electronTRPC = previous;
    }
  }
}

export class FakeFrame {
  readonly frameToken = `frame-token-${nextId++}`;
  document: FakeDocument = new FakeDocument(this);
  detached = false;
  destroyed = false;

  constructor(
    readonly webContents: FakeWebContents,
    readonly processId: number,
    readonly routingId: number,
    readonly frameTreeNodeId: number
  ) {
    framesByRoutingId.set(`${processId}:${routingId}`, this);
  }

  isDestroyed() {
    return this.destroyed;
  }

  send(channel: string, response: ETRPCResponse) {
    if (channel !== ELECTRON_TRPC_CHANNEL || this.detached || this.destroyed) return;
    const message = structuredClone(response);
    const document = this.document;
    deliver(() => document.receive(message));
  }

  receiveFromDocument(document: FakeDocument, request: ETRPCRequest) {
    const gone = this.detached || this.destroyed || this.document !== document;
    const event = { sender: this.webContents, senderFrame: gone ? null : this };
    ipcMain.emit(ELECTRON_TRPC_CHANNEL, event, request);
  }

  replaceDocument() {
    this.document.alive = false;
    this.document = new FakeDocument(this);
  }

  remove() {
    this.document.alive = false;
    this.detached = true;
    this.destroyed = true;
  }
}

export class FakeWebContents extends EventEmitter {
  readonly id = nextId++;
  readonly processId = nextId++;
  mainFrame: FakeFrame;
  subframes: FakeFrame[] = [];
  destroyed = false;

  constructor() {
    super();
    this.mainFrame = new FakeFrame(this, this.processId, nextId++, nextId++);
  }

  isDestroyed() {
    return this.destroyed;
  }

  addSubframe(routingId: number = nextId++): FakeFrame {
    const frame = new FakeFrame(this, this.processId, routingId, nextId++);
    this.subframes.push(frame);
    this.emit('frame-created', {}, { frame });
    return frame;
  }

  /** Removes an iframe from the page, which Electron doesn't emit any event for. */
  removeSubframe(frame: FakeFrame) {
    frame.remove();
    this.subframes = this.subframes.filter((subframe) => subframe !== frame);
  }

  /**
   * Commits a cross-document navigation in `frame`. With `newHost`, the new document gets a new
   * frame host, as with a cross-process navigation, and the old one is detached.
   */
  navigate(frame: FakeFrame, { newHost = false } = {}): FakeFrame {
    const isMainFrame = frame === this.mainFrame;
    let target = frame;

    if (newHost) {
      frame.remove();
      target = new FakeFrame(this, nextId++, nextId++, frame.frameTreeNodeId);
    } else {
      frame.replaceDocument();
    }

    if (isMainFrame) {
      this.mainFrame = target;
      for (const subframe of this.subframes) subframe.remove();
      this.subframes = [];
    } else if (newHost) {
      this.subframes = this.subframes.map((subframe) => (subframe === frame ? target : subframe));
    }

    this.emit(
      'did-frame-navigate',
      {},
      'app://next',
      200,
      'OK',
      isMainFrame,
      target.processId,
      target.routingId
    );
    return target;
  }

  /** A navigation that starts but never commits, such as a download or a 204 response. */
  startNavigation(frame: FakeFrame) {
    this.emit('did-start-navigation', {
      isSameDocument: false,
      isMainFrame: frame === this.mainFrame,
      frame,
    });
  }

  navigateInPage(frame: FakeFrame) {
    this.emit('did-start-navigation', {
      isSameDocument: true,
      isMainFrame: frame === this.mainFrame,
      frame,
    });
    this.emit(
      'did-navigate-in-page',
      {},
      'app://same#hash',
      frame === this.mainFrame,
      frame.processId,
      frame.routingId
    );
  }

  crash() {
    for (const frame of [this.mainFrame, ...this.subframes]) frame.document.alive = false;
    this.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
  }

  destroy() {
    for (const frame of [this.mainFrame, ...this.subframes]) frame.remove();
    this.destroyed = true;
    this.emit('destroyed');
  }
}

export const reset = () => {
  ipcMain.removeAllListeners();
  ipcRenderer.removeAllListeners();
  framesByRoutingId.clear();
  session.defaultSession = new FakeSession();
  vi.clearAllMocks();
};
