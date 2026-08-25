<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  calculateReaderCanvasContrast,
  normalizeReaderCanvas,
  resolveReaderCanvas,
  type ReaderCanvasInput,
  type ReaderCanvasValues,
} from '@/utils/readerCanvas';

interface Props {
  canvas: ReaderCanvasInput;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:canvas': [value: ReaderCanvasValues];
}>();

const { t } = useI18n();
const initialCanvas = resolveReaderCanvas(props.canvas);
const mode = ref(initialCanvas.mode);
const backgroundDraft = ref(initialCanvas.values.content_background_color);
const textDraft = ref(initialCanvas.values.content_text_color);
const invalid = ref(false);

const isCustom = computed(() => mode.value === 'custom');
const contrastRatio = computed(() =>
  calculateReaderCanvasContrast(backgroundDraft.value, textDraft.value)
);
const contrastLabel = computed(() =>
  Number.isFinite(contrastRatio.value) ? contrastRatio.value.toFixed(2) : '—'
);
const backgroundSwatchValue = computed(() =>
  /^#[0-9a-f]{6}$/i.test(backgroundDraft.value) ? backgroundDraft.value : '#ffffff'
);
const textSwatchValue = computed(() =>
  /^#[0-9a-f]{6}$/i.test(textDraft.value) ? textDraft.value : '#111111'
);

function syncDrafts(canvas: ReaderCanvasInput): void {
  const resolved = resolveReaderCanvas(canvas);
  mode.value = resolved.mode;
  backgroundDraft.value = resolved.values.content_background_color;
  textDraft.value = resolved.values.content_text_color;
  invalid.value = false;
}

watch(
  () => [props.canvas.content_background_color, props.canvas.content_text_color],
  () => syncDrafts(props.canvas)
);

function commitIfReadable(): void {
  const canvas = normalizeReaderCanvas({
    content_background_color: backgroundDraft.value,
    content_text_color: textDraft.value,
  });
  const readable = Boolean(canvas.content_background_color);
  invalid.value = !readable;

  if (!readable) return;

  backgroundDraft.value = canvas.content_background_color;
  textDraft.value = canvas.content_text_color;
  emit('update:canvas', canvas);
}

function useThemeMode(): void {
  mode.value = 'theme';
  backgroundDraft.value = '';
  textDraft.value = '';
  invalid.value = false;
  emit('update:canvas', {
    content_background_color: '',
    content_text_color: '',
  });
}

function useCustomMode(): void {
  if (isCustom.value) return;

  mode.value = 'custom';
  const appCanvas = normalizeReaderCanvas({
    content_background_color: getComputedStyle(document.documentElement).getPropertyValue(
      '--bg-primary'
    ),
    content_text_color: getComputedStyle(document.documentElement).getPropertyValue(
      '--text-primary'
    ),
  });

  backgroundDraft.value = appCanvas.content_background_color;
  textDraft.value = appCanvas.content_text_color;
  invalid.value = !appCanvas.content_background_color;

  if (appCanvas.content_background_color) {
    emit('update:canvas', appCanvas);
  }
}

function updateBackground(value: string): void {
  backgroundDraft.value = value;
  commitIfReadable();
}

function updateText(value: string): void {
  textDraft.value = value;
  commitIfReadable();
}
</script>

<template>
  <section class="reader-canvas-controls" data-testid="reader-canvas-controls">
    <div class="reader-canvas-heading">
      <span>{{ t('setting.typography.readerCanvas') }}</span>
      <output
        class="reader-canvas-contrast"
        data-testid="reader-canvas-contrast"
        aria-live="polite"
        :aria-invalid="invalid ? 'true' : undefined"
      >
        {{ t('setting.typography.readerCanvasContrast', { ratio: contrastLabel }) }}
      </output>
    </div>

    <div class="reader-canvas-mode" role="group" :aria-label="t('setting.typography.readerCanvas')">
      <button
        type="button"
        class="reader-canvas-mode-button"
        :class="{ 'is-active': !isCustom }"
        data-testid="reader-canvas-mode-theme"
        :aria-pressed="!isCustom"
        @click="useThemeMode"
      >
        {{ t('setting.typography.readerCanvasTheme') }}
      </button>
      <button
        type="button"
        class="reader-canvas-mode-button"
        :class="{ 'is-active': isCustom }"
        data-testid="reader-canvas-mode-custom"
        :aria-pressed="isCustom"
        @click="useCustomMode"
      >
        {{ t('setting.typography.readerCanvasCustom') }}
      </button>
    </div>

    <div v-if="isCustom" class="reader-canvas-fields">
      <div class="reader-canvas-field">
        <label class="reader-canvas-label" for="reader-canvas-background-input">
          {{ t('setting.typography.readerCanvasBackground') }}
        </label>
        <div class="reader-canvas-inputs">
          <input
            class="reader-canvas-swatch"
            data-testid="reader-canvas-background-swatch"
            type="color"
            :value="backgroundSwatchValue"
            :aria-label="t('setting.typography.readerCanvasBackground')"
            @input="updateBackground(($event.target as HTMLInputElement).value)"
          />
          <input
            id="reader-canvas-background-input"
            class="reader-canvas-text-input"
            data-testid="reader-canvas-background-input"
            type="text"
            :value="backgroundDraft"
            :aria-label="t('setting.typography.readerCanvasBackground')"
            :aria-invalid="invalid ? 'true' : undefined"
            autocomplete="off"
            spellcheck="false"
            @input="updateBackground(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="reader-canvas-field">
        <label class="reader-canvas-label" for="reader-canvas-text-input">
          {{ t('setting.typography.readerCanvasText') }}
        </label>
        <div class="reader-canvas-inputs">
          <input
            class="reader-canvas-swatch"
            data-testid="reader-canvas-text-swatch"
            type="color"
            :value="textSwatchValue"
            :aria-label="t('setting.typography.readerCanvasText')"
            @input="updateText(($event.target as HTMLInputElement).value)"
          />
          <input
            id="reader-canvas-text-input"
            class="reader-canvas-text-input"
            data-testid="reader-canvas-text-input"
            type="text"
            :value="textDraft"
            :aria-label="t('setting.typography.readerCanvasText')"
            :aria-invalid="invalid ? 'true' : undefined"
            autocomplete="off"
            spellcheck="false"
            @input="updateText(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <p v-if="invalid" class="reader-canvas-warning" role="alert">
      {{ t('setting.typography.readerCanvasContrastInvalid') }}
    </p>
  </section>
</template>

<style scoped>
@reference "../../style.css";

.reader-canvas-controls {
  @apply flex flex-col gap-2 rounded-lg border border-border bg-bg-secondary p-3;
}

.reader-canvas-heading {
  @apply flex items-center justify-between gap-3 text-xs font-medium text-text-secondary;
}

.reader-canvas-contrast {
  @apply shrink-0 font-mono text-[0.68rem] tabular-nums text-text-tertiary;
}

.reader-canvas-contrast[aria-invalid='true'] {
  color: var(--state-danger-color);
}

.reader-canvas-mode {
  @apply grid grid-cols-2 gap-1.5;
}

.reader-canvas-mode-button {
  @apply min-w-0 rounded-md border border-border bg-bg-primary px-2 py-2 text-xs font-medium text-text-secondary transition-colors;
  min-height: var(--ui-control-height);
}

.reader-canvas-mode-button:hover {
  @apply bg-bg-tertiary text-text-primary;
}

.reader-canvas-mode-button.is-active {
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px var(--accent-color);
  color: var(--accent-color);
}

.reader-canvas-mode-button:focus-visible,
.reader-canvas-swatch:focus-visible,
.reader-canvas-text-input:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.reader-canvas-fields {
  @apply grid grid-cols-2 gap-2;
}

.reader-canvas-field {
  @apply min-w-0 flex flex-col gap-1;
}

.reader-canvas-label {
  @apply text-[0.68rem] font-medium text-text-secondary;
}

.reader-canvas-inputs {
  @apply flex items-center gap-1.5;
}

.reader-canvas-swatch {
  @apply shrink-0 cursor-pointer rounded border border-border bg-transparent p-0;
  width: var(--ui-control-compact-height);
  height: var(--ui-control-compact-height);
}

.reader-canvas-text-input {
  @apply min-w-0 w-full rounded border border-border bg-bg-primary px-2 py-1.5 font-mono text-xs text-text-primary outline-none;
}

.reader-canvas-text-input[aria-invalid='true'] {
  border-color: var(--state-danger-border);
}

.reader-canvas-warning {
  @apply m-0 text-xs;
  color: var(--state-danger-color);
}

@media (max-width: 24rem) {
  .reader-canvas-fields {
    @apply grid-cols-1;
  }
}
</style>
