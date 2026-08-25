<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhMinus, PhPlus, PhX } from '@phosphor-icons/vue';
import FontFamilySelect from '@/components/settings/FontFamilySelect.vue';
import ReaderCanvasColorControls from '@/components/settings/ReaderCanvasColorControls.vue';
import ReaderTypographyPresetPicker from '@/components/settings/ReaderTypographyPresetPicker.vue';
import ReaderTypographyPreview from '@/components/settings/ReaderTypographyPreview.vue';
import {
  resolveReaderCanvas,
  type ReaderCanvasInput,
  type ReaderCanvasValues,
} from '@/utils/readerCanvas';
import {
  normalizeReaderTypography,
  resolveReaderTypography,
  type ReaderTypographyInput,
  type ReaderTypographyValues,
} from '@/utils/readerTypography';

interface Props {
  anchor: HTMLElement | null;
  settings: ReaderTypographyInput & ReaderCanvasInput;
  saveError?: boolean;
}

type Density = 'compact' | 'balanced' | 'relaxed';

const densityValues: Record<Density, Partial<ReaderTypographyValues>> = {
  compact: { content_line_height: '1.5', content_paragraph_spacing: 'compact' },
  balanced: { content_line_height: '1.6', content_paragraph_spacing: 'comfortable' },
  relaxed: { content_line_height: '1.8', content_paragraph_spacing: 'relaxed' },
};

const props = withDefaults(defineProps<Props>(), {
  saveError: false,
});

const emit = defineEmits<{
  close: [];
  'select-preset': [values: ReaderTypographyValues];
  'update-typography': [patch: Partial<ReaderTypographyValues>];
  'update-canvas': [values: ReaderCanvasValues];
  'restore-default-typography': [];
  'retry-save': [];
}>();

const { t } = useI18n();
const panelRef = ref<HTMLElement | null>(null);
const isMobile = ref(false);
const position = ref({ left: 8, top: 8 });
const typography = computed(() => normalizeReaderTypography(props.settings));
const readerTypography = computed(() => resolveReaderTypography(props.settings));
const readerCanvas = computed(() => resolveReaderCanvas(props.settings));
const popoverStyle = computed(() => ({
  left: `${position.value.left}px`,
  top: `${position.value.top}px`,
}));
let mediaQuery: MediaQueryList | null = null;
let savedBodyOverflow: string | null = null;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function updatePosition(): void {
  if (isMobile.value) return;

  const rect = props.anchor?.getBoundingClientRect();
  const panelRect = panelRef.value?.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const panelWidth = panelRect?.width || 352;
  const panelHeight = panelRect?.height || 560;
  const margin = 8;
  const targetLeft = rect ? rect.right - panelWidth : margin;
  const belowAnchor = rect ? rect.bottom + margin : margin;
  const aboveAnchor = rect ? rect.top - panelHeight - margin : margin;
  const targetTop =
    belowAnchor + panelHeight <= viewportHeight - margin ? belowAnchor : aboveAnchor;

  position.value = {
    left: clamp(targetLeft, margin, viewportWidth - panelWidth - margin),
    top: clamp(targetTop, margin, viewportHeight - panelHeight - margin),
  };
}

function lockBodyScroll(): void {
  if (savedBodyOverflow !== null) return;

  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
}

function restoreBodyScroll(): void {
  if (savedBodyOverflow === null) return;

  document.body.style.overflow = savedBodyOverflow;
  savedBodyOverflow = null;
}

function getFocusableElements(): HTMLElement[] {
  if (!panelRef.value) return [];

  return Array.from(
    panelRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function focusFirstControl(): void {
  getFocusableElements()[0]?.focus();
}

function syncViewport(): void {
  isMobile.value = mediaQuery?.matches ?? false;

  if (isMobile.value) {
    lockBodyScroll();
  } else {
    restoreBodyScroll();
  }

  void nextTick(() => {
    updatePosition();
    focusFirstControl();
  });
}

function handleMediaChange(): void {
  syncViewport();
}

function handlePointerDown(event: PointerEvent): void {
  if (isMobile.value) return;

  const target = event.target;
  if (!(target instanceof Node)) return;
  if (panelRef.value?.contains(target) || props.anchor?.contains(target)) return;

  emit('close');
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;

  event.preventDefault();
  emit('close');
}

function handlePanelKeydown(event: KeyboardEvent): void {
  if (!isMobile.value || event.key !== 'Tab') return;

  const focusable = getFocusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && (currentIndex <= 0 || document.activeElement === first)) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && (currentIndex === -1 || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}

function handleOverlayClick(event: MouseEvent): void {
  if (isMobile.value && event.target === event.currentTarget) {
    emit('close');
  }
}

function changeFontSize(delta: -1 | 1): void {
  const current = typography.value.content_font_size;
  const next = clamp(current + delta, 10, 24);

  if (next !== current) {
    emit('update-typography', { content_font_size: next });
  }
}

function applyDensity(density: Density): void {
  emit('update-typography', densityValues[density]);
}

function isDensityActive(density: Density): boolean {
  const values = densityValues[density];

  return (
    typography.value.content_line_height === values.content_line_height &&
    typography.value.content_paragraph_spacing === values.content_paragraph_spacing
  );
}

function updateFontFamily(value: string | number): void {
  emit('update-typography', { content_font_family: String(value) });
}

watch(
  () => props.anchor,
  () => void nextTick(updatePosition)
);

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 639px)');
  syncViewport();
  document.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('keydown', handleWindowKeydown);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleMediaChange);
  } else {
    mediaQuery.addListener(handleMediaChange);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown, true);
  window.removeEventListener('keydown', handleWindowKeydown);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
  restoreBodyScroll();

  if (mediaQuery?.removeEventListener) {
    mediaQuery.removeEventListener('change', handleMediaChange);
  } else {
    mediaQuery?.removeListener(handleMediaChange);
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      class="reader-appearance-host"
      :class="{ 'reader-appearance-host--mobile': isMobile }"
      :data-testid="isMobile ? 'reader-appearance-sheet' : undefined"
      @click="handleOverlayClick"
    >
      <section
        id="reader-appearance-panel"
        ref="panelRef"
        class="reader-appearance-panel"
        :class="isMobile ? 'reader-appearance-panel--sheet' : 'reader-appearance-panel--popover'"
        :style="isMobile ? undefined : popoverStyle"
        data-testid="reader-appearance-panel"
        data-modal-open="true"
        role="dialog"
        :aria-modal="isMobile ? 'true' : undefined"
        :aria-labelledby="'reader-appearance-title'"
        @keydown="handlePanelKeydown"
      >
        <header class="reader-appearance-header app-panel-header">
          <h2 id="reader-appearance-title" class="ui-page-title">
            {{ t('article.readingMode.appearanceTitle') }}
          </h2>
          <button
            type="button"
            class="ui-icon-button ui-button--ghost"
            :aria-label="t('article.readingMode.appearanceClose')"
            :title="t('article.readingMode.appearanceClose')"
            @click="emit('close')"
          >
            <PhX :size="18" aria-hidden="true" />
          </button>
        </header>

        <div class="reader-appearance-content">
          <ReaderTypographyPresetPicker
            :settings="settings"
            variant="compact"
            @select="emit('select-preset', $event)"
          />

          <div class="reader-appearance-control" data-testid="reader-font-family-control">
            <span class="reader-appearance-label">{{
              t('setting.typography.contentFontFamily')
            }}</span>
            <FontFamilySelect
              :model-value="typography.content_font_family"
              @update:model-value="updateFontFamily"
            />
          </div>

          <div class="reader-appearance-control" data-testid="reader-font-size-control">
            <span class="reader-appearance-label">{{
              t('article.readingMode.appearanceFontSize')
            }}</span>
            <div class="reader-appearance-font-size">
              <button
                type="button"
                class="ui-button ui-button--secondary w-full gap-1 px-2 text-sm"
                data-testid="reader-font-decrease"
                :disabled="typography.content_font_size <= 10"
                :aria-label="t('article.readingMode.appearanceDecreaseFontSize')"
                @click="changeFontSize(-1)"
              >
                <PhMinus :size="16" aria-hidden="true" />
                <span aria-hidden="true">A</span>
              </button>
              <output class="reader-appearance-font-value" aria-live="polite">
                {{ typography.content_font_size }} px
              </output>
              <button
                type="button"
                class="ui-button ui-button--secondary w-full gap-1 px-2 text-sm"
                data-testid="reader-font-increase"
                :disabled="typography.content_font_size >= 24"
                :aria-label="t('article.readingMode.appearanceIncreaseFontSize')"
                @click="changeFontSize(1)"
              >
                <span aria-hidden="true">A</span>
                <PhPlus :size="16" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="reader-appearance-control">
            <span class="reader-appearance-label">{{
              t('article.readingMode.appearanceDensity')
            }}</span>
            <div class="reader-appearance-option-row" role="group">
              <button
                v-for="density in ['compact', 'balanced', 'relaxed'] as Density[]"
                :key="density"
                type="button"
                class="reader-appearance-option"
                :class="{ 'is-active': isDensityActive(density) }"
                :data-testid="`reader-density-${density}`"
                :aria-pressed="isDensityActive(density)"
                @click="applyDensity(density)"
              >
                {{
                  t(
                    `article.readingMode.appearanceDensity${density[0].toUpperCase()}${density.slice(1)}`
                  )
                }}
              </button>
            </div>
          </div>

          <div
            v-if="!isMobile"
            class="reader-appearance-control"
            data-testid="reader-width-control"
          >
            <span class="reader-appearance-label">{{
              t('article.readingMode.appearanceWidth')
            }}</span>
            <div class="reader-appearance-option-row" role="group">
              <button
                v-for="width in ['narrow', 'comfortable', 'wide']"
                :key="width"
                type="button"
                class="reader-appearance-option"
                :class="{ 'is-active': typography.content_width === width }"
                :data-testid="`reader-width-${width}`"
                :aria-pressed="typography.content_width === width"
                @click="
                  emit('update-typography', {
                    content_width: width as ReaderTypographyValues['content_width'],
                  })
                "
              >
                {{ t(`setting.typography.contentWidth${width[0].toUpperCase()}${width.slice(1)}`) }}
              </button>
            </div>
          </div>

          <ReaderCanvasColorControls
            :canvas="settings"
            @update:canvas="emit('update-canvas', $event)"
          />

          <ReaderTypographyPreview :typography="readerTypography" :canvas="readerCanvas" />
        </div>

        <footer class="reader-appearance-footer">
          <button
            type="button"
            class="ui-button ui-button--ghost ui-button--compact"
            data-testid="reader-appearance-restore"
            @click="emit('restore-default-typography')"
          >
            {{ t('article.readingMode.appearanceRestoreDefault') }}
          </button>
          <button
            v-if="saveError"
            type="button"
            class="ui-button ui-button--secondary ui-button--compact"
            data-testid="reader-appearance-retry"
            @click="emit('retry-save')"
          >
            {{ t('article.readingMode.appearanceRetrySave') }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
@reference "../../style.css";

.reader-appearance-host {
  display: contents;
}

.reader-appearance-host--mobile {
  @apply fixed inset-0 z-[80] flex items-end;
  background: var(--overlay-backdrop, rgb(0 0 0 / 0.42));
}

.reader-appearance-panel {
  @apply z-[81] border border-border bg-bg-primary text-text-primary;
  box-shadow: 0 18px 48px var(--overlay-shadow-color, rgb(0 0 0 / 0.22));
}

.reader-appearance-panel--popover {
  @apply fixed w-[24rem] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl;
}

.reader-appearance-panel--sheet {
  @apply w-full max-h-[min(44rem,calc(100dvh-1rem))] overflow-y-auto rounded-t-2xl;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.reader-appearance-header {
  @apply sticky top-0 z-10;
}

.reader-appearance-option:hover {
  @apply bg-bg-tertiary;
}

.reader-appearance-option:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.reader-appearance-content {
  @apply flex flex-col gap-4 px-4 py-4;
}

.reader-appearance-control {
  @apply flex flex-col gap-2;
}

.reader-appearance-label {
  @apply text-xs font-medium text-text-secondary;
}

.reader-appearance-font-size {
  @apply grid grid-cols-[1fr_auto_1fr] items-center gap-2;
}

.reader-appearance-font-value {
  @apply min-w-14 text-center text-sm font-medium tabular-nums;
}

.reader-appearance-option-row {
  @apply grid grid-cols-3 gap-1.5;
}

.reader-appearance-option {
  @apply min-w-0 rounded-md border border-border bg-bg-primary px-2 py-2 text-xs font-medium text-text-secondary transition-colors;
  min-height: var(--ui-control-height);
}

.reader-appearance-option.is-active {
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px var(--accent-color);
  color: var(--accent-color);
}

.reader-appearance-footer {
  @apply flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3;
}

@media (max-width: 639px) {
  .reader-appearance-content {
    @apply gap-3 px-4 py-3;
  }
}
</style>
