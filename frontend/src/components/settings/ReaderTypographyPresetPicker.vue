<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhCheckCircle } from '@phosphor-icons/vue';
import {
  getReaderTypographyPreset,
  readerTypographyPresets,
  type ReaderTypographyInput,
  type ReaderTypographyPresetId,
  type ReaderTypographyValues,
} from '@/utils/readerTypography';

interface Props {
  settings: ReaderTypographyInput;
  variant?: 'settings' | 'compact';
}

interface PresetOption {
  id: ReaderTypographyPresetId;
  label: string;
  description: string;
  values: ReaderTypographyValues;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'settings',
});

const emit = defineEmits<{
  select: [values: ReaderTypographyValues];
}>();

const { t } = useI18n();
const pickerRef = ref<HTMLElement>();
const selectedPreset = computed(() => getReaderTypographyPreset(props.settings));
const options = computed<PresetOption[]>(() =>
  readerTypographyPresets.map((preset) => ({
    id: preset.id,
    label: t(`setting.typography.readerPreset${preset.id[0].toUpperCase()}${preset.id.slice(1)}`),
    description: t(
      `setting.typography.readerPreset${preset.id[0].toUpperCase()}${preset.id.slice(1)}Desc`
    ),
    values: { ...preset.values },
  }))
);

function selectPreset(values: ReaderTypographyValues): void {
  emit('select', values);
}

function isTabbableOption(option: PresetOption, index: number): boolean {
  return selectedPreset.value === 'custom' ? index === 0 : selectedPreset.value === option.id;
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
</script>

<template>
  <div
    class="reader-typography-preset-section"
    :class="{ 'reader-typography-preset-section--compact': variant === 'compact' }"
  >
    <div
      v-if="variant === 'settings' || selectedPreset === 'custom'"
      class="reader-typography-preset-heading"
    >
      <span v-if="variant === 'settings'">{{ t('setting.typography.readerPreset') }}</span>
      <span
        v-if="selectedPreset === 'custom'"
        data-testid="reader-preset-custom"
        :class="{ 'reader-typography-preset-custom--compact': variant === 'compact' }"
      >
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
        :aria-checked="selectedPreset === option.id"
        :aria-label="option.label"
        :tabindex="isTabbableOption(option, index) ? 0 : -1"
        @click="selectPreset(option.values)"
        @keydown="handleKeydown($event, index)"
      >
        <span class="reader-typography-preset-copy">
          <span class="reader-typography-preset-label">{{ option.label }}</span>
          <span class="reader-typography-preset-description">{{ option.description }}</span>
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

.reader-typography-preset-custom--compact {
  @apply ml-auto;
}

.reader-typography-preset-picker,
.reader-typography-preset-picker--compact {
  @apply grid grid-cols-2 gap-2 w-full;
}

.reader-typography-preset-picker--compact {
  @apply gap-1.5;
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
</style>
