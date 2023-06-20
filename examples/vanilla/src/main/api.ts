import z from 'zod';
import { initTRPC } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

const t = initTRPC.create({ isServer: true });
const publicProcedure = t.procedure;

function createCounterRouter() {
  const ee = new EventEmitter();
  let count = 0;

  return t.router({
    increment: publicProcedure.mutation(() => {
      count++;
      ee.emit('event::increment', count);
      console.log(count);
    }),

    count: publicProcedure.query(() => {
      return {
        count,
      };
    }),

    onCount: t.procedure.subscription(() => {
      return observable<{ count: number }>((emit) => {
        function onIncrement(count: number) {
          emit.next({ count });
        }

        ee.on('event::increment', onIncrement);

        return () => {
          ee.off('event::increment', onIncrement);
        };
      });
    }),
  });
}

console.log('hello from main');

export const router = t.router({
  greeting: publicProcedure.input(z.object({ name: z.string() })).query((req) => {
    const { input } = req;

    return {
      text: `Hello ${input.name}` as const,
    };
  }),

  counter: createCounterRouter(),
});

export type AppRouter = typeof router;
