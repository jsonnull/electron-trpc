import { describe, expect, MockedFunction, test, vi } from 'vitest';
import { z } from 'zod';
import * as trpc from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { handleIPCMessage } from '../handleIPCMessage';
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

    await handleIPCMessage({
      createContext: async () => ({}),
      event,
      internalId: '1-1:1',
      message: {
        method: 'request',
        operation: {
          context: {},
          id: 1,
          input: { id: 'test-id' },
          path: 'testQuery',
          type: 'query',
        },
      },
      router: testRouter,
      subscriptions: new Map(),
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

    await handleIPCMessage({
      createContext: async () => ({}),
      event,
      internalId: '1-1:1',
      message: {
        method: 'request',
        operation: {
          context: {},
          id: 1,
          input: { id: 'test-id' },
          path: 'testQuery',
          type: 'query',
        },
      },
      router: testRouter,
      subscriptions: new Map(),
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

    await handleIPCMessage({
      createContext: async () => ({}),
      message: {
        method: 'request',
        operation: {
          context: {},
          id: 1,
          input: undefined,
          path: 'testSubscription',
          type: 'subscription',
        },
      },
      internalId: '1-1:1',
      subscriptions: new Map(),
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

  test('subscription responds using custom serializer', async () => {
    const event = makeEvent({
      sender: {
        isDestroyed: () => false,
        on: () => {},
        send: vi.fn(),
      },
    });

    const t = trpc.initTRPC.create({
      transformer: {
        deserialize: (input: unknown) => {
          const serialized = (input as string).replace(/^serialized:/, '');
          return JSON.parse(serialized);
        },
        serialize: (input) => {
          return `serialized:${JSON.stringify(input)}`;
        },
      },
    });

    const testRouter = t.router({
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

    await handleIPCMessage({
      createContext: async () => ({}),
      message: {
        method: 'request',
        operation: {
          context: {},
          id: 1,
          input: undefined,
          path: 'testSubscription',
          type: 'subscription',
        },
      },
      internalId: '1-1:1',
      subscriptions: new Map(),
      router: testRouter,
      event,
    });

    expect(event.sender.send).not.toHaveBeenCalled();

    ee.emit('test');

    expect(event.sender.send).toHaveBeenCalledOnce();
    expect(event.sender.send.mock.lastCall[1]).toMatchObject({
      id: 1,
      result: {
        type: 'data',
        data: 'serialized:"test response"',
      },
    });
  });
});
