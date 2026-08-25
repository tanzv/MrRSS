<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhCheckCircle } from '@phosphor-icons/vue';
import type { BuiltInThemePreset, CustomThemeProfile } from '@/types/theme';
import { getThemePreferenceId } from '@/utils/customTheme';
import { normalizeThemePreference, type ThemePreference } from '@/utils/theme';

interface Props {
  modelValue: ThemePreference | string;
  profiles?: CustomThemeProfile[];
}

interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  previewPresets: readonly BuiltInThemePreset[];
}

const props = withDefaults(defineProps<Props>(), {
  profiles: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: ThemePreference];
}>();

const { t } = useI18n();
const pickerRef = ref<HTMLElement>();

const options = computed<ThemeOption[]>(() => [
  {
    value: 'auto',
    label: t('setting.general.auto'),
    description: t('setting.general.themeAutoDesc'),
    previewPresets: ['paper', 'ink'],
  },
  {
    value: 'paper',
    label: t('setting.general.themePaper'),
    description: t('setting.general.themePaperDesc'),
    previewPresets: ['paper'],
  },
  {
    value: 'ink',
    label: t('setting.general.themeInk'),
    description: t('setting.general.themeInkDesc'),
    previewPresets: ['ink'],
  },
  {
    value: 'sepia',
    label: t('setting.general.themeSepia'),
    description: t('setting.general.themeSepiaDesc'),
    previewPresets: ['sepia'],
  },
  {
    value: 'high-contrast',
    label: t('setting.general.themeHighContrast'),
    description: t('setting.general.themeHighContrastDesc'),
    previewPresets: ['high-contrast'],
  },
  ...props.profiles.map((profile) => ({
    value: getThemePreferenceId(profile),
    label: profile.name,
    description: t('setting.general.customTheme.themeOptionDescription'),
    previewPresets: [profile.basePreset],
  })),
]);

const selectedValue = computed<ThemePreference>(() => {
  const normalized = normalizeThemePreference(props.modelValue);
  return options.value.some((option) => option.value === normalized) ? normalized : 'auto';
});

function selectTheme(value: ThemePreference) {
  emit('update:modelValue', value);
}

function focusOption(value: ThemePreference) {
  void nextTick(() => {
    pickerRef.value?.querySelector<HTMLButtonElement>(`[data-theme-option="${value}"]`)?.focus();
  });
}

function handleKeydown(event: KeyboardEvent, currentIndex: number) {
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

  if (nextIndex === null) {
    return;
  }

  event.preventDefault();
  const nextValue = options.value[nextIndex]?.value;
  if (!nextValue) {
    return;
  }
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
      :data-theme-preview="option.previewPresets[0]"
      :aria-checked="selectedValue === option.value"
      :tabindex="selectedValue === option.value ? 0 : -1"
      @click="selectTheme(option.value)"
      @keydown="handleKeydown($event, index)"
    >
      <span
        class="theme-preset-preview"
        :class="{ 'is-adaptive': option.previewPresets.length > 1 }"
        aria-hidden="true"
      >
        <span
          v-for="preset in option.previewPresets"
          :key="preset"
          class="theme-preset-preview-shell"
          :data-theme-preview-shell="preset"
        >
          <span class="theme-preset-preview-rail">
            <span class="theme-preset-preview-active"></span>
          </span>
          <span class="theme-preset-preview-content">
            <span class="theme-preset-preview-heading"></span>
            <span class="theme-preset-preview-line"></span>
            <span class="theme-preset-preview-line is-short"></span>
            <span class="theme-preset-preview-action"></span>
          </span>
        </span>
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
  @apply min-w-0 grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 text-left p-2 rounded-lg border border-border bg-bg-primary text-text-primary transition-colors;
}

.theme-preset-option[data-theme-option='auto'] {
  @apply col-span-2 grid-cols-[5.125rem_minmax(0,1fr)_auto];
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
  @apply w-10 h-8 flex overflow-hidden rounded border border-border;
}

.theme-preset-preview.is-adaptive {
  @apply w-[5.125rem] gap-px p-px;
  background: var(--border-color);
}

.theme-preset-preview-shell {
  display: grid;
  min-width: 0;
  flex: 1 1 0;
  grid-template-columns: 0.6rem minmax(0, 1fr);
  overflow: hidden;
  background: var(--preview-canvas);
}

.theme-preset-preview-shell[data-theme-preview-shell='paper'] {
  --preview-canvas: #f8fafc;
  --preview-rail: #eef2f6;
  --preview-selected: #dbeafe;
  --preview-copy: #18212f;
  --preview-muted: #59697a;
  --preview-accent: #2563eb;
}

.theme-preset-preview-shell[data-theme-preview-shell='ink'] {
  --preview-canvas: #15181d;
  --preview-rail: #11151a;
  --preview-selected: #24384b;
  --preview-copy: #eef3f8;
  --preview-muted: #93a1b0;
  --preview-accent: #69b7ff;
}

.theme-preset-preview-shell[data-theme-preview-shell='sepia'] {
  --preview-canvas: #f5f1ea;
  --preview-rail: #e9e0d3;
  --preview-selected: #ead8c5;
  --preview-copy: #2f2924;
  --preview-muted: #6b6158;
  --preview-accent: #9a4d24;
}

.theme-preset-preview-shell[data-theme-preview-shell='high-contrast'] {
  --preview-canvas: #000000;
  --preview-rail: #0a0a0a;
  --preview-selected: #3d3500;
  --preview-copy: #ffffff;
  --preview-muted: #f5f5f5;
  --preview-accent: #ffe600;
}

.theme-preset-preview-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--preview-rail);
}

.theme-preset-preview-active {
  display: block;
  width: 60%;
  height: 0.3rem;
  border-radius: 0.0625rem;
  background: var(--preview-selected);
}

.theme-preset-preview-content {
  position: relative;
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 0.125rem;
  padding: 0.35rem 0.3rem;
  background: var(--preview-canvas);
}

.theme-preset-preview-heading,
.theme-preset-preview-line,
.theme-preset-preview-action {
  display: block;
}

.theme-preset-preview-heading {
  width: 76%;
  height: 0.125rem;
  border-radius: 0.0625rem;
  background: var(--preview-copy);
}

.theme-preset-preview-line {
  width: 100%;
  height: 1px;
  background: var(--preview-muted);
  opacity: 0.72;
}

.theme-preset-preview-line.is-short {
  width: 58%;
}

.theme-preset-preview-action {
  position: absolute;
  right: 0.3rem;
  bottom: 0.35rem;
  width: 0.4rem;
  height: 0.2rem;
  border-radius: 0.0625rem;
  background: var(--preview-accent);
}

.theme-preset-copy {
  @apply min-w-0 flex flex-col gap-0.5;
}

.theme-preset-label {
  @apply text-sm font-medium leading-tight;
  overflow-wrap: anywhere;
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

@media (prefers-reduced-motion: reduce) {
  .theme-preset-option {
    transition: none;
  }
}
</style>
