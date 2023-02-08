import { describe, expect, MockedFunction, test, vi } from 'vitest';
import { z } from 'zod';
import * as trpc from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { handleIPCOperation } from '../handleIPCOperation';
import { IpcMainInvokeEvent } from 'electron';

interface MockEvent {
  sender: {
    isDestroyed: () => boolean;
    on: (event: string, cb: () => void) => void;
    send: MockedFunction<any>;
  };
}
const makeEvent = (event: MockEvent) =>
  event as unknown as IpcMainInvokeEvent & { sender: { send: MockedFunction<any> } };

const ee = new EventEmitter();

const t = trpc.initTRPC.create();
const testRouter = t.router({
  testQuery: t.procedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(({ input }) => {
      return { id: input.id, isTest: true };
    }),
  testSubscription: t.procedure.subscription(() => {
    return observable((emit) => {
      function testResponse() {
        emit.next('test response');
      }

      ee.on('test', testResponse);
      return () => ee.off('test', testResponse);
    });
  }),
});

describe('api', () => {
  test('handles queries', async () => {
    const event = makeEvent({
      sender: {
        isDestroyed: () => false,
        on: () => {},
        send: vi.fn(),
      },
    });

    await handleIPCOperation({
      createContext: async () => ({}),
      operation: { context: {}, id: 1, input: { id: 'test-id' }, path: 'testQuery', type: 'query' },
      router: testRouter,
      event,
    });

    expect(event.sender.send).toHaveBeenCalledOnce();
    expect(event.sender.send.mock.lastCall[1]).toMatchObject({
      id: 1,
      result: {
        data: {
          id: 'test-id',
          isTest: true,
        },
      },
    });
  });

  test('does not respond if sender is gone', async () => {
    const event = makeEvent({
      sender: {
        isDestroyed: () => true,
        on: () => {},
        send: vi.fn(),
      },
    });

    await handleIPCOperation({
      createContext: async () => ({}),
      operation: { context: {}, id: 1, input: { id: 'test-id' }, path: 'testQuery', type: 'query' },
      router: testRouter,
      event,
    });

    expect(event.sender.send).not.toHaveBeenCalled();
  });

  test('handles subscriptions', async () => {
    const event = makeEvent({
      sender: {
        isDestroyed: () => false,
        on: () => {},
        send: vi.fn(),
      },
    });

    await handleIPCOperation({
      createContext: async () => ({}),
      operation: {
        context: {},
        id: 1,
        input: undefined,
        path: 'testSubscription',
        type: 'subscription',
      },
      router: testRouter,
      event,
    });

    expect(event.sender.send).not.toHaveBeenCalled();

    ee.emit('test');

    expect(event.sender.send).toHaveBeenCalledOnce();
    expect(event.sender.send.mock.lastCall[1]).toMatchObject({
      id: 1,
      result: {
        data: 'test response',
      },
    });
  });

  test('cancels subscriptions when webcontents are closed', async () => {
    let isDestroyed = false;
    let onDestroyed: () => void;
    const event = makeEvent({
      sender: {
        isDestroyed: () => isDestroyed,
        send: vi.fn(),
        on: (_event: string, cb: () => void) => {
          onDestroyed = cb;
        },
      },
    });

    await handleIPCOperation({
      createContext: async () => ({}),
      operation: {
        context: {},
        id: 1,
        input: undefined,
        path: 'testSubscription',
        type: 'subscription',
      },
      router: testRouter,
      event,
    });

    expect(event.sender.send).not.toHaveBeenCalled();

    onDestroyed();

    ee.emit('test');

    expect(event.sender.send).not.toHaveBeenCalled();
  });
});
