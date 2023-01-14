---
layout: home
---

<script setup>
import ExamplesButton from './.vitepress/ExamplesButton.vue'
import Features from './.vitepress/Features.vue'
import Hero from './.vitepress/Hero.vue'
</script>

<style type="text/css">
.custom-home .vp-code-group {
    margin: 0;
}
.custom-home .vp-doc div[class*='language-'] {
    margin: 0;
}
.custom-home .vp-code-group .tabs {
    margin-left: 0;
    margin-right: 0;
}
</style>

<div class="custom-home flex flex-col max-w-[1152px] mx-4 md-mx-auto px-0 sm-px-8 pt-16">

<Hero />

<div class="vp-doc pt-16">

<div class="flex flex-col lg-flex-row gap-4 w-full">
<div class="flex-1 min-w-0">

::: code-group

```ts [renderer.tsx]
function HelloElectron() {
  const { data } = trpcReact.greeting.useQuery({
    name: 'Electron',
  });

  if (!data) return null;

  return <div>{data.text}</div>; // Hello Electron
}
```

:::

</div>
<div class="flex-1 min-w-0">

::: code-group

```ts [main.ts]
export const router = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return {
        text: `Hello ${input.name}`,
      };
    }),
});
```

:::

</div>
</div>

</div>

<ExamplesButton />

<Features />

</div>
