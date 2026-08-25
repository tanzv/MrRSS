<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  modelValue?: string;
  label: string;
  description?: string;
  inheritedValue?: string;
  resetLabel?: string;
  resetVersion?: number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  description: '',
  inheritedValue: '',
  resetLabel: 'Reset to inherited value',
  resetVersion: 0,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
}>();

const draft = ref(props.modelValue ?? '');
const invalid = ref(false);

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value ?? '';
    invalid.value = false;
  }
);

watch(
  () => props.resetVersion,
  () => {
    draft.value = props.modelValue ?? '';
    invalid.value = false;
  }
);

const inherited = computed(() => props.inheritedValue || '');
const colorInputValue = computed(() => {
  const value = props.modelValue ?? inherited.value;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#808080';
});

function isValidColor(value: string): boolean {
  return /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value.trim());
}

function updateText(value: string): void {
  draft.value = value;
  const normalized = value.trim().toLowerCase();
  invalid.value = normalized.length > 0 && !isValidColor(normalized);
  if (!invalid.value && normalized) {
    emit('update:modelValue', normalized);
  }
}

function updateColor(value: string): void {
  draft.value = value;
  invalid.value = false;
  emit('update:modelValue', value.toLowerCase());
}

function reset(): void {
  draft.value = '';
  invalid.value = false;
  emit('update:modelValue', undefined);
}
</script>

<template>
  <div class="theme-color-field" :class="{ 'is-invalid': invalid }">
    <div class="theme-color-copy">
      <label :for="`theme-color-${label}`" class="theme-color-label">{{ label }}</label>
      <span v-if="description" class="theme-color-description">{{ description }}</span>
      <span v-if="inherited" class="theme-color-inherited">
        {{ inherited }}
      </span>
    </div>
    <div class="theme-color-controls" :data-testid="`theme-color-controls-${label}`">
      <input
        class="theme-color-swatch"
        type="color"
        :value="colorInputValue"
        :aria-label="label"
        @input="updateColor(($event.target as HTMLInputElement).value)"
      />
      <input
        :id="`theme-color-${label}`"
        class="theme-color-text"
        type="text"
        :value="draft"
        :aria-label="label"
        :aria-invalid="invalid"
        spellcheck="false"
        @input="updateText(($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        class="theme-color-reset"
        data-action="reset-token"
        :aria-label="resetLabel"
        :title="resetLabel"
        @click="reset"
      >
        <span aria-hidden="true">&#8634;</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.theme-color-field {
  @apply flex items-center justify-between gap-3 rounded-md border border-border bg-bg-primary p-2;
}

.theme-color-copy {
  @apply min-w-0 flex flex-col gap-0.5;
}

.theme-color-label {
  @apply text-xs font-medium text-text-primary;
}

.theme-color-description,
.theme-color-inherited {
  @apply text-[0.68rem] text-text-secondary;
}

.theme-color-inherited {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.theme-color-controls {
  @apply flex shrink-0 items-center gap-1.5;
}

.theme-color-swatch {
  @apply cursor-pointer rounded border border-border bg-transparent p-0;
  width: var(--ui-control-compact-height);
  height: var(--ui-control-compact-height);
}

.theme-color-text {
  @apply w-24 rounded border border-border bg-bg-secondary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent;
}

.theme-color-reset {
  @apply flex items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent;
  width: var(--ui-control-compact-height);
  height: var(--ui-control-compact-height);
}

.theme-color-field.is-invalid .theme-color-text {
  border-color: var(--state-danger-border);
}

@media (max-width: 32rem) {
  .theme-color-field {
    @apply items-start flex-col;
  }

  .theme-color-controls {
    @apply w-full;
  }

  .theme-color-text {
    @apply flex-1;
  }
}
</style>
