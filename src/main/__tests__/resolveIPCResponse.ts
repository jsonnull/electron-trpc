import { describe, expect, test } from 'vitest'
import { router } from '@trpc/server'
import { z } from 'zod'
import { resolveIPCResponse } from '../resolveIPCResponse'

const testRouter = router().query('test', {
  input: z.object({
    id: z.string(),
  }),
  async resolve(req) {
    return { id: req.input.id, isTest: true }
  },
})

describe('api', () => {
  test('can manually call into API', async () => {
    const response = await resolveIPCResponse({
      createContext: async () => ({}),
      type: 'query',
      path: 'test',
      input: { id: 'test-id' },
      router: testRouter,
    })

    expect(response).toMatchObject({
      id: null,
      result: {
        data: {
          id: 'test-id',
          isTest: true,
        },
        type: 'data',
      },
    })
  })

  test('does not handle subscriptions', async () => {
    const response = await resolveIPCResponse({
      createContext: async () => ({}),
      type: 'subscription',
      path: 'test',
      input: { id: 'test-id' },
      router: testRouter,
    })

    expect((response as any).error.message).toBe('Unexpected operation subscription')
    expect((response as any).error.data.code).toBe('METHOD_NOT_SUPPORTED')
  })
})
