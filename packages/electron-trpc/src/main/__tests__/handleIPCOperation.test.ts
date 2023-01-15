import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import * as trpc from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { handleIPCOperation } from '../handleIPCOperation';

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
  test('can manually call into API', async () => {
    const respond = vi.fn();
    await handleIPCOperation({
      createContext: async () => ({}),
      operation: { context: {}, id: 1, input: { id: 'test-id' }, path: 'testQuery', type: 'query' },
      router: testRouter,
      respond,
    });

    expect(respond).toHaveBeenCalledOnce();
    expect(respond.mock.lastCall[0]).toMatchObject({
      id: 1,
      result: {
        data: {
          id: 'test-id',
          isTest: true,
        },
      },
    });
  });

  test('does not handle subscriptions', async () => {
    const respond = vi.fn();

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
      respond,
    });

    expect(respond).not.toHaveBeenCalled();

    ee.emit('test');

    expect(respond).toHaveBeenCalledOnce();
    expect(respond.mock.lastCall[0]).toMatchObject({
      id: 1,
      result: {
        data: 'test response',
      },
    });
  });
});
