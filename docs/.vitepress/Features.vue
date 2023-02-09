<script setup>
import { ref } from 'vue';

const features = ref([
  {
    title: 'Main <-> Renderer',
    description: "Expose APIs from electron's main process to one or more renderer processes.",
  },
  {
    title: 'Fully type-safe IPC',
    description:
      'Build electron IPC with all the benefits of tRPC, including inferred client types.',
  },
  {
    title: 'Secure platform alternative to localhost',
    description: 'Electron IPC is faster and more secure than opening local servers for IPC.',
  },
  {
    title: 'Queries, mutations, and subscriptions',
    description:
      'Supports all tRPC features. No need to write complicated bi-directional IPC schemes.',
  },
]);
</script>

<template>
  <div class="flex flex-col md-flex-row gap-4 pt-16 w-full">
    <div
      v-for="feature in features"
      class="flex flex-col flex-1 p-4 rounded bg-[var(--vp-c-bg-soft)]"
    >
      <h2 class="font-500">{{ feature.title }}</h2>
      <p class="pt-1 text-[var(--vp-c-text-2)]">{{ feature.description }}</p>
    </div>
  </div>
</template>
