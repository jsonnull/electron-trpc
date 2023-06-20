import { initTRPC } from '@trpc/server';

export type AppRouter = typeof appRouter;

const t = initTRPC.create({ isServer: true });

const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  greet: publicProcedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val;
      throw new Error(`Invalid input: ${typeof val}`);
    })
    .query(({ input }) => ({ greeting: `hello, ${input}!` })),
});
