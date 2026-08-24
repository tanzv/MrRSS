<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhCheckCircle, PhSparkle } from '@phosphor-icons/vue';
import type { ThemePreset } from '@/utils/theme';
import {
  getRecommendedReaderTypographyPreset,
  getReaderTypographyPreset,
  readerThemePresetMap,
  readerTypographyPresets,
  type ReaderTypographyInput,
  type ReaderTypographyPresetId,
  type ReaderTypographyValues,
} from '@/utils/readerTypography';

interface Props {
  settings: ReaderTypographyInput;
  themePreset?: ThemePreset;
  variant?: 'settings' | 'compact';
}

interface PresetOption {
  id: ReaderTypographyPresetId;
  label: string;
  description: string;
  values: ReaderTypographyValues;
  themePreset?: ThemePreset;
  themeLabel?: string;
  recommended: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  themePreset: 'paper',
  variant: 'settings',
});

const emit = defineEmits<{
  select: [values: ReaderTypographyValues];
}>();

const { t } = useI18n();
const pickerRef = ref<HTMLElement>();

const readerPresetThemes = new Map<ReaderTypographyPresetId, ThemePreset>(
  (Object.entries(readerThemePresetMap) as [ThemePreset, ReaderTypographyPresetId][]).map(
    ([themePreset, presetId]) => [presetId, themePreset]
  )
);
const selectedPreset = computed(() => getReaderTypographyPreset(props.settings));
const recommendedPreset = computed(() => getRecommendedReaderTypographyPreset(props.themePreset));
const themeLabels = computed<Record<ThemePreset, string>>(() => ({
  paper: t('setting.general.themePaper'),
  ink: t('setting.general.themeInk'),
  sepia: t('setting.general.themeSepia'),
  'high-contrast': t('setting.general.themeHighContrast'),
}));
const options = computed<PresetOption[]>(() =>
  readerTypographyPresets.map((preset) => {
    const themePreset = readerPresetThemes.get(preset.id);

    return {
      id: preset.id,
      label: t(`setting.typography.readerPreset${preset.id[0].toUpperCase()}${preset.id.slice(1)}`),
      description: t(
        `setting.typography.readerPreset${preset.id[0].toUpperCase()}${preset.id.slice(1)}Desc`
      ),
      values: { ...preset.values },
      themePreset,
      themeLabel: themePreset ? themeLabels.value[themePreset] : undefined,
      recommended: preset.id === recommendedPreset.value.id,
    };
  })
);

function selectPreset(values: ReaderTypographyValues): void {
  emit('select', values);
}

function focusOption(id: ReaderTypographyPresetId): void {
  void nextTick(() => {
    pickerRef.value?.querySelector<HTMLButtonElement>(`[data-reader-preset="${id}"]`)?.focus();
  });
}

function handleKeydown(event: KeyboardEvent, currentIndex: number): void {
  const lastIndex = options.value.length - 1;
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

  if (nextIndex === null) return;

  event.preventDefault();
  const nextOption = options.value[nextIndex];
  selectPreset(nextOption.values);
  focusOption(nextOption.id);
}

function getOptionAriaLabel(option: PresetOption): string {
  if (!option.themeLabel) return option.label;

  return option.recommended
    ? t('setting.typography.readerPresetThemeRecommendedAria', {
        style: option.label,
        theme: option.themeLabel,
      })
    : t('setting.typography.readerPresetThemeAria', {
        style: option.label,
        theme: option.themeLabel,
      });
}
</script>

<template>
  <div
    class="reader-typography-preset-section"
    :class="{ 'reader-typography-preset-section--compact': variant === 'compact' }"
  >
    <div v-if="variant === 'settings'" class="reader-typography-preset-heading">
      <span>{{ t('setting.typography.readerPreset') }}</span>
      <span v-if="selectedPreset === 'custom'" data-testid="reader-preset-custom">
        {{ t('setting.typography.readerPresetCustom') }}
      </span>
    </div>
    <div
      ref="pickerRef"
      class="reader-typography-preset-picker"
      :class="{ 'reader-typography-preset-picker--compact': variant === 'compact' }"
      role="radiogroup"
      :aria-label="t('setting.typography.readerPreset')"
    >
      <button
        v-for="(option, index) in options"
        :key="option.id"
        type="button"
        role="radio"
        class="reader-typography-preset-option"
        :class="{ 'is-selected': selectedPreset === option.id }"
        :data-reader-preset="option.id"
        :data-reader-style-theme="option.themePreset"
        :data-reader-theme-recommendation="option.recommended ? 'true' : undefined"
        :aria-checked="selectedPreset === option.id"
        :aria-label="getOptionAriaLabel(option)"
        :tabindex="selectedPreset === option.id ? 0 : -1"
        @click="selectPreset(option.values)"
        @keydown="handleKeydown($event, index)"
      >
        <span class="reader-typography-preset-copy">
          <span class="reader-typography-preset-label-row">
            <span class="reader-typography-preset-label">{{ option.label }}</span>
            <span
              v-if="option.themePreset && option.themeLabel"
              class="reader-typography-preset-theme"
              :data-reader-style-theme="option.themePreset"
            >
              <span class="reader-typography-theme-swatch" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
              {{ option.themeLabel }}
            </span>
          </span>
          <span class="reader-typography-preset-description">{{ option.description }}</span>
        </span>
        <span
          v-if="option.recommended"
          class="reader-typography-preset-recommended"
          :title="t('setting.typography.readerPresetRecommended', { theme: option.themeLabel })"
        >
          <PhSparkle :size="16" aria-hidden="true" />
        </span>
        <PhCheckCircle
          v-if="selectedPreset === option.id"
          :size="18"
          class="reader-typography-preset-selected"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.reader-typography-preset-section {
  @apply flex flex-col gap-2;
}

.reader-typography-preset-heading {
  @apply flex items-center justify-between gap-3 text-xs font-medium text-text-secondary;
}

.reader-typography-preset-picker {
  @apply grid grid-cols-2 gap-2 w-full;
}

.reader-typography-preset-picker--compact {
  @apply grid-cols-1 gap-1;
}

.reader-typography-preset-option {
  @apply min-w-0 flex items-start justify-between gap-2 p-2 rounded-md border border-border bg-bg-primary text-left text-text-primary transition-colors;
}

.reader-typography-preset-picker--compact .reader-typography-preset-option {
  @apply px-2.5 py-2;
}

.reader-typography-preset-option:hover {
  @apply bg-bg-tertiary;
}

.reader-typography-preset-option.is-selected {
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px var(--accent-color);
}

.reader-typography-preset-option:focus-visible {
  outline: 2px solid var(--accent-color) !important;
  outline-offset: 2px;
}

.reader-typography-preset-copy {
  @apply min-w-0 flex flex-col gap-0.5;
}

.reader-typography-preset-label-row {
  @apply min-w-0 flex flex-wrap items-center gap-1.5;
}

.reader-typography-preset-label {
  @apply text-sm font-medium leading-tight;
}

.reader-typography-preset-description {
  @apply text-xs text-text-secondary leading-snug;
  overflow-wrap: anywhere;
}

.reader-typography-preset-selected {
  @apply shrink-0;
  color: var(--accent-color);
}

.reader-typography-preset-recommended {
  @apply shrink-0 text-text-secondary;
}

.reader-typography-preset-theme {
  @apply inline-flex items-center gap-1 text-xs leading-tight text-text-secondary;
}

.reader-typography-theme-swatch {
  display: grid;
  grid-template-columns: repeat(3, 0.375rem);
  overflow: hidden;
  width: 1.125rem;
  height: 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 2px;
}

.reader-typography-preset-option[data-reader-style-theme='paper']
  .reader-typography-theme-swatch
  span:nth-child(1) {
  background: #ffffff;
}

.reader-typography-preset-option[data-reader-style-theme='paper']
  .reader-typography-theme-swatch
  span:nth-child(2) {
  background: #e8edf2;
}

.reader-typography-preset-option[data-reader-style-theme='paper']
  .reader-typography-theme-swatch
  span:nth-child(3) {
  background: #0066d6;
}

.reader-typography-preset-option[data-reader-style-theme='ink']
  .reader-typography-theme-swatch
  span:nth-child(1) {
  background: #1e1e1e;
}

.reader-typography-preset-option[data-reader-style-theme='ink']
  .reader-typography-theme-swatch
  span:nth-child(2) {
  background: #30343b;
}

.reader-typography-preset-option[data-reader-style-theme='ink']
  .reader-typography-theme-swatch
  span:nth-child(3) {
  background: #73baff;
}

.reader-typography-preset-option[data-reader-style-theme='sepia']
  .reader-typography-theme-swatch
  span:nth-child(1) {
  background: #f7f1e3;
}

.reader-typography-preset-option[data-reader-style-theme='sepia']
  .reader-typography-theme-swatch
  span:nth-child(2) {
  background: #e1d3b9;
}

.reader-typography-preset-option[data-reader-style-theme='sepia']
  .reader-typography-theme-swatch
  span:nth-child(3) {
  background: #8b3a18;
}

.reader-typography-preset-option[data-reader-style-theme='high-contrast']
  .reader-typography-theme-swatch
  span:nth-child(1) {
  background: #000000;
}

.reader-typography-preset-option[data-reader-style-theme='high-contrast']
  .reader-typography-theme-swatch
  span:nth-child(2) {
  background: #252525;
}

.reader-typography-preset-option[data-reader-style-theme='high-contrast']
  .reader-typography-theme-swatch
  span:nth-child(3) {
  background: #ffe600;
}

@media (max-width: 32rem) {
  .reader-typography-preset-picker {
    @apply grid-cols-1;
  }
}
</style>
