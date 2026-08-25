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
  <button
    type="button"
    :class="['ui-button', `ui-button--${type ?? 'secondary'}`]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
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
