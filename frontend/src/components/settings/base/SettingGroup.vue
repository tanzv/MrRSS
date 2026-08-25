<script setup lang="ts">
import { ref } from 'vue';
import type { Component } from 'vue';
import { PhCaretRight, PhCaretDown } from '@phosphor-icons/vue';

interface Props {
  icon?: Component;
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  description: '',
  collapsible: false,
  defaultCollapsed: false,
});

const isCollapsed = ref(props.defaultCollapsed);

function toggleCollapse() {
  if (props.collapsible) {
    isCollapsed.value = !isCollapsed.value;
  }
}
</script>

<template>
  <div class="setting-group">
    <label
      class="setting-group-label ui-section-title"
      :class="{ 'cursor-pointer hover:text-text-primary': collapsible }"
      @click="toggleCollapse"
    >
      <component :is="icon" v-if="icon" :size="14" class="sm:w-4 sm:h-4" />
      <span>{{ title }}</span>
      <component
        :is="collapsible ? (isCollapsed ? PhCaretRight : PhCaretDown) : null"
        :size="14"
        class="ml-auto"
      />
    </label>
    <div class="text-xs text-text-secondary mb-2 sm:mb-3 pl-6">
      <slot name="description">{{ description }}</slot>
    </div>
    <div v-show="!isCollapsed" class="setting-group-children">
      <slot />
    </div>
  </div>
</template>

<style scoped>
@reference "../../../style.css";
.setting-group {
  @apply mb-4 sm:mb-6;
}

.setting-group-label {
  @apply mb-2 flex items-center gap-2 text-text-secondary uppercase tracking-wider sm:mb-3;
}

.setting-group-children > :not(:first-child) {
  @apply mt-2 sm:mt-3;
}
</style>
