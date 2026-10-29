import { EventEmitter, on } from 'node:events';
import { initTRPC } from '@trpc/server';
import z from 'zod';

const ee = new EventEmitter();

const t = initTRPC.create({ isServer: true });

export const router = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => ({ text: `Hello ${input.name}` })),
  greet: t.procedure.input(z.object({ name: z.string() })).mutation(({ input }) => {
    ee.emit('greeting', `Greeted ${input.name}`);
  }),
  greetings: t.procedure.subscription(async function* ({ signal }) {
    for await (const [text] of on(ee, 'greeting', { signal })) {
      yield { text };
    }
  }),
});
