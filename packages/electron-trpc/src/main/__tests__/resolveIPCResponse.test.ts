import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { resolveIPCResponse } from '../resolveIPCResponse';
import * as trpc from '@trpc/server';

const t = trpc.initTRPC.create();
const testRouter = t.router({
  test: t.procedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(({ input }) => {
      return { id: input.id, isTest: true };
    }),
});

describe('api', () => {
  test('can manually call into API', async () => {
    const resolved = await resolveIPCResponse({
      createContext: async () => ({}),
      operation: { context: {}, id: 1, input: { id: 'test-id' }, path: 'test', type: 'query' },
      router: testRouter,
    });

    expect(resolved).toMatchObject({
      response: {
        result: {
          data: {
            id: 'test-id',
            isTest: true,
          },
        },
      },
    });
  });

  test('does not handle subscriptions', async () => {
    resolveIPCResponse({
      createContext: async () => ({}),
      operation: {
        context: {},
        id: 1,
        input: { id: 'test-id' },
        path: 'test',
        type: 'subscription',
      },
      router: testRouter,
    }).catch((cause) => {
      expect(cause.name).toBe('TRPCError');
      expect(cause.message).toBe('Subscriptions should use wsLink');
      expect(cause.code).toBe('METHOD_NOT_SUPPORTED');
    });
  });
});
