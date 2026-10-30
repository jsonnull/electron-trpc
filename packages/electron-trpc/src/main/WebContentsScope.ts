import { webFrameMain } from 'electron';
import type { WebContents, WebFrameMain } from 'electron';
import debugFactory from 'debug';
import { ClientScope } from './ClientScope';

const debug = debugFactory('electron-trpc:main:WebContentsScope');

// A frame tree node id is unique to one frame and never reused, unlike `frameToken`, which only
// identifies a frame within its renderer process and doesn't exist before Electron 38.
const isSameFrame = (a: WebFrameMain, b: WebFrameMain) => a.frameTreeNodeId === b.frameTreeNodeId;

/**
 * The clients of every document in one `WebContents`. Clients are disposed when the document they
 * belong to goes away: a cross-document navigation in their frame or the main frame, a crashed
 * renderer, or the `WebContents` being destroyed.
 */
export class WebContentsScope implements Disposable {
  readonly #clients = new Map<string, ClientScope>();
  readonly #stack = new DisposableStack();

  constructor(
    readonly webContents: WebContents,
    onDestroyed: () => void
  ) {
    const onFrameNavigate = (
      _event: Electron.Event,
      _url: string,
      _httpResponseCode: number,
      _httpStatusText: string,
      isMainFrame: boolean,
      frameProcessId: number,
      frameRoutingId: number
    ) => {
      if (isMainFrame) {
        debug('Main frame navigated', webContents.id);
        this.#disposeClients(() => true);
        return;
      }

      const frameTreeNodeId = webFrameMain.fromId(frameProcessId, frameRoutingId)?.frameTreeNodeId;
      debug('Subframe navigated', webContents.id, frameTreeNodeId);
      // Subframes of the navigated frame are gone too, and show up as detached or destroyed.
      this.#disposeClients(
        (client) => !client.isLive || client.frame.frameTreeNodeId === frameTreeNodeId
      );
    };
    // A good moment to notice removed iframes, which Electron has no event for.
    const onFrameCreated = () => this.#disposeDeadClients();
    const onRenderProcessGone = () => {
      debug('Render process gone', webContents.id);
      this.#disposeClients(() => true);
    };

    webContents.on('did-frame-navigate', onFrameNavigate);
    webContents.on('frame-created', onFrameCreated);
    webContents.on('render-process-gone', onRenderProcessGone);
    webContents.once('destroyed', onDestroyed);
    this.#stack.defer(() => {
      webContents.off('did-frame-navigate', onFrameNavigate);
      webContents.off('frame-created', onFrameCreated);
      webContents.off('render-process-gone', onRenderProcessGone);
      webContents.off('destroyed', onDestroyed);
    });
    this.#stack.defer(() => this.#disposeClients(() => true));
  }

  /** Returns the client for a message, or `undefined` if the id belongs to another frame. */
  findClient(frame: WebFrameMain, clientId: string): ClientScope | undefined {
    this.#disposeDeadClients();
    const client = this.#clients.get(clientId);
    if (client && !isSameFrame(client.frame, frame)) {
      debug('Ignoring message for a client in another frame', clientId);
      return undefined;
    }
    return client;
  }

  /** Like `findClient`, but creates the client the first time it sends a request. */
  client(frame: WebFrameMain, clientId: string): ClientScope | undefined {
    this.#disposeDeadClients();
    if (this.#clients.has(clientId)) return this.findClient(frame, clientId);

    const client = new ClientScope(frame, clientId, (empty) => {
      if (this.#clients.get(clientId) === empty) this.#clients.delete(clientId);
    });
    this.#clients.set(clientId, client);
    return client;
  }

  /** Disposes clients whose frame is gone, such as one in an iframe that was removed. */
  #disposeDeadClients() {
    this.#disposeClients((client) => !client.isLive);
  }

  #disposeClients(predicate: (client: ClientScope) => boolean) {
    for (const [clientId, client] of [...this.#clients]) {
      if (!predicate(client)) continue;
      this.#clients.delete(clientId);
      client[Symbol.dispose]();
    }
  }

  [Symbol.dispose]() {
    this.#stack.dispose();
  }
}
