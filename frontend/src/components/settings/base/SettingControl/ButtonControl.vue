<script setup lang="ts">
import type { Component } from 'vue';

interface Props {
  label?: string;
  icon?: Component;
  type?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void | Promise<void>;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [];
}>();

async function handleClick() {
  emit('click');
}
</script>

<template>
  <button class="btn" :class="[`btn-${type}`]" :disabled="disabled || loading" @click="handleClick">
    <component
      :is="icon"
      v-if="icon"
      :size="16"
      class="sm:w-5 sm:h-5"
      :class="{ 'animate-spin': loading }"
    />
    <span v-if="label">{{ label }}</span>
    <span v-if="loading">{{ '...' }}</span>
  </button>
</template>

<style scoped>
@reference "../../../../style.css";
.btn {
  @apply px-3 sm:px-4 py-1.5 sm:py-2 rounded-md cursor-pointer flex items-center gap-1.5 sm:gap-2 font-medium transition-colors shrink-0;
}

.btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.btn-primary {
  @apply bg-accent border-none hover:bg-accent-hover;
  color: var(--accent-foreground);
}

.btn-secondary {
  @apply bg-bg-tertiary border border-border text-text-primary hover:bg-bg-secondary;
}

.btn-danger {
  @apply bg-transparent border;
  border-color: var(--state-danger-border);
  color: var(--state-danger-color);
}

.btn-danger:hover {
  background-color: var(--state-danger-background);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
