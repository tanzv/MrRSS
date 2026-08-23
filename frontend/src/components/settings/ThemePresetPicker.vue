<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhCheckCircle } from '@phosphor-icons/vue';
import { normalizeThemePreference, themePreferences, type ThemePreference } from '@/utils/theme';

interface Props {
  modelValue: ThemePreference | string;
}

interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: ThemePreference];
}>();

const { t } = useI18n();
const pickerRef = ref<HTMLElement>();

const selectedValue = computed(() => normalizeThemePreference(props.modelValue));
const options = computed<ThemeOption[]>(() => [
  {
    value: 'auto',
    label: t('setting.general.auto'),
    description: t('setting.general.themeAutoDesc'),
  },
  {
    value: 'paper',
    label: t('setting.general.themePaper'),
    description: t('setting.general.themePaperDesc'),
  },
  {
    value: 'ink',
    label: t('setting.general.themeInk'),
    description: t('setting.general.themeInkDesc'),
  },
  {
    value: 'sepia',
    label: t('setting.general.themeSepia'),
    description: t('setting.general.themeSepiaDesc'),
  },
  {
    value: 'high-contrast',
    label: t('setting.general.themeHighContrast'),
    description: t('setting.general.themeHighContrastDesc'),
  },
]);

function selectTheme(value: ThemePreference) {
  emit('update:modelValue', value);
}

function focusOption(value: ThemePreference) {
  void nextTick(() => {
    pickerRef.value?.querySelector<HTMLButtonElement>(`[data-theme-option="${value}"]`)?.focus();
  });
}

function handleKeydown(event: KeyboardEvent, currentIndex: number) {
  const lastIndex = themePreferences.length - 1;
  let nextIndex: number | null = null;

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = lastIndex;
  }

  if (nextIndex === null) {
    return;
  }

  event.preventDefault();
  const nextValue = themePreferences[nextIndex];
  selectTheme(nextValue);
  focusOption(nextValue);
}
</script>

<template>
  <div
    ref="pickerRef"
    class="theme-preset-picker"
    role="radiogroup"
    :aria-label="t('setting.general.theme')"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="radio"
      class="theme-preset-option"
      :class="{ 'is-selected': selectedValue === option.value }"
      :data-theme-option="option.value"
      :aria-checked="selectedValue === option.value"
      :tabindex="selectedValue === option.value ? 0 : -1"
      @click="selectTheme(option.value)"
      @keydown="handleKeydown($event, index)"
    >
      <span class="theme-preset-preview" aria-hidden="true">
        <span class="theme-preset-preview-surface"></span>
        <span class="theme-preset-preview-secondary"></span>
        <span class="theme-preset-preview-accent"></span>
      </span>
      <span class="theme-preset-copy">
        <span class="theme-preset-label">{{ option.label }}</span>
        <span class="theme-preset-description">{{ option.description }}</span>
      </span>
      <PhCheckCircle
        v-if="selectedValue === option.value"
        :size="18"
        class="theme-preset-selected"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.theme-preset-picker {
  @apply grid grid-cols-2 gap-2 w-full;
}

.theme-preset-option {
  @apply min-w-0 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 text-left p-2 rounded-lg border border-border bg-bg-primary text-text-primary transition-colors;
}

.theme-preset-option[data-theme-option='auto'] {
  @apply col-span-2;
}

.theme-preset-option:hover {
  @apply bg-bg-tertiary;
}

.theme-preset-option.is-selected {
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px var(--accent-color);
}

.theme-preset-option:focus-visible {
  outline: 2px solid var(--accent-color) !important;
  outline-offset: 2px;
}

.theme-preset-preview {
  @apply w-9 h-7 grid grid-cols-[1.35fr_1fr_0.45fr] overflow-hidden rounded border border-border;
}

.theme-preset-preview-surface {
  background: #ffffff;
}

.theme-preset-preview-secondary {
  background: #e8edf2;
}

.theme-preset-preview-accent {
  background: #0066d6;
}

.theme-preset-option[data-theme-option='auto'] .theme-preset-preview-surface {
  background: #ffffff;
}

.theme-preset-option[data-theme-option='auto'] .theme-preset-preview-secondary {
  background: #1e1e1e;
}

.theme-preset-option[data-theme-option='auto'] .theme-preset-preview-accent {
  background: #73baff;
}

.theme-preset-option[data-theme-option='ink'] .theme-preset-preview-surface {
  background: #1e1e1e;
}

.theme-preset-option[data-theme-option='ink'] .theme-preset-preview-secondary {
  background: #30343b;
}

.theme-preset-option[data-theme-option='ink'] .theme-preset-preview-accent {
  background: #73baff;
}

.theme-preset-option[data-theme-option='sepia'] .theme-preset-preview-surface {
  background: #f7f1e3;
}

.theme-preset-option[data-theme-option='sepia'] .theme-preset-preview-secondary {
  background: #e1d3b9;
}

.theme-preset-option[data-theme-option='sepia'] .theme-preset-preview-accent {
  background: #8b3a18;
}

.theme-preset-option[data-theme-option='high-contrast'] .theme-preset-preview-surface {
  background: #000000;
}

.theme-preset-option[data-theme-option='high-contrast'] .theme-preset-preview-secondary {
  background: #252525;
}

.theme-preset-option[data-theme-option='high-contrast'] .theme-preset-preview-accent {
  background: #ffe600;
}

.theme-preset-copy {
  @apply min-w-0 flex flex-col gap-0.5;
}

.theme-preset-label {
  @apply text-sm font-medium leading-tight;
}

.theme-preset-description {
  @apply text-xs text-text-secondary leading-snug;
  overflow-wrap: anywhere;
}

.theme-preset-selected {
  color: var(--accent-color);
}

@media (max-width: 28rem) {
  .theme-preset-picker {
    @apply grid-cols-1;
  }

  .theme-preset-option[data-theme-option='auto'] {
    @apply col-span-1;
  }
}
</style>
