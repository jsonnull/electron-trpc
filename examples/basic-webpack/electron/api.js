const { initTRPC } = require('@trpc/server');
const z = require('zod');

const t = initTRPC.create({ isServer: true });

exports.router = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => ({ text: `Hello ${input.name}` })),
});
