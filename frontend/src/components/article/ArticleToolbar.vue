<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSettings } from '@/composables/core/useSettings';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useReaderTypographyPreferences } from '@/composables/article/useReaderTypographyPreferences';
import { useAppStore } from '@/stores/app';
import ReaderAppearancePanel from './ReaderAppearancePanel.vue';
import {
  PhArrowLeft,
  PhArrowLineUp,
  PhX,
  PhGlobe,
  PhArticle,
  PhEnvelopeOpen,
  PhEnvelope,
  PhStar,
  PhClockCountdown,
  PhArrowSquareOut,
  PhLinkSimple,
  PhTranslate,
  PhArrowClockwise,
  PhBookOpen,
  PhTextAa,
  PhMagnifyingGlass,
  PhListBullets,
  PhDotsThree,
  PhCheck,
  PhCaretLeft,
  PhCaretRight,
} from '@phosphor-icons/vue';
import type { Article } from '@/types/models';
import { copyArticleLink } from '@/utils/clipboard';

const translationDisplayModes = ['original', 'bilingual', 'translation'] as const;
type TranslationDisplayMode = (typeof translationDisplayModes)[number];

const { t } = useI18n();
const { settings, fetchSettings } = useSettings();
const store = useAppStore();
const readingModeEntryTrigger = ref<HTMLButtonElement | null>(null);
const mobileBackTrigger = ref<HTMLButtonElement | null>(null);
const closeArticleTrigger = ref<HTMLButtonElement | null>(null);
const appearanceTrigger = ref<HTMLButtonElement | null>(null);
const isReaderAppearanceOpen = ref(false);
const readerContentsTrigger = ref<HTMLButtonElement | null>(null);
const readerMoreTrigger = ref<HTMLButtonElement | null>(null);
const readerMoreMenu = ref<HTMLElement | null>(null);
const isReaderMoreOpen = ref(false);
const readerMorePosition = ref({ left: 8, top: 8 });
const {
  applyPreset,
  flushSave,
  restoreDefaultTypography,
  retrySave,
  saveError,
  saveState,
  updateCanvas,
  updateTypography,
} = useReaderTypographyPreferences({ settings });

onMounted(async () => {
  try {
    await fetchSettings();
  } catch (e) {
    console.error('Error loading settings:', e);
  }
});

interface Props {
  article: Article;
  showContent: boolean;
  showTranslations?: boolean;
  translationDisplayMode?: TranslationDisplayMode;
  showContents?: boolean;
  isModal?: boolean;
  isReadingMode?: boolean;
  readingProgress?: number | null;
  hasReaderContent?: boolean;
  hasPreviousArticle?: boolean;
  hasNextArticle?: boolean;
  restoredReadingProgress?: number | null;
  restoreContentsFocus?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTranslations: true,
  translationDisplayMode: undefined,
  showContents: false,
  isModal: false,
  isReadingMode: false,
  readingProgress: null,
  hasReaderContent: false,
  hasPreviousArticle: false,
  hasNextArticle: false,
  restoredReadingProgress: null,
  restoreContentsFocus: true,
});

const emit = defineEmits<{
  close: [];
  toggleContentView: [];
  toggleReadingMode: [];
  toggleRead: [];
  toggleFavorite: [];
  toggleReadLater: [];
  openOriginal: [];
  toggleTranslations: [];
  openFind: [];
  toggleContents: [];
  navigatePrevious: [];
  navigateNext: [];
  scrollToTop: [];
  setTranslationDisplayMode: [mode: TranslationDisplayMode];
  reloadContent: [];
  exportToObsidian: [];
  exportToNotion: [];
  exportToZotero: [];
}>();

const readingProgressPercent = computed(() => {
  if (props.readingProgress === null || props.readingProgress === undefined) return 0;

  const progress = props.readingProgress;
  if (!Number.isFinite(progress)) return 0;

  return Math.min(100, Math.max(0, Math.round(progress)));
});

const hasReadingProgress = computed(
  () =>
    props.isReadingMode &&
    props.readingProgress !== null &&
    props.readingProgress !== undefined &&
    Number.isFinite(props.readingProgress)
);

const selectedTranslationDisplayMode = computed<TranslationDisplayMode>(() => {
  if (props.translationDisplayMode) return props.translationDisplayMode;
  if (!props.showTranslations) return 'original';
  return settings.value.translation_only_mode ? 'translation' : 'bilingual';
});

const selectedTranslationDisplayModeLabel = computed(() =>
  t(
    `article.readingMode.translation${
      selectedTranslationDisplayMode.value[0].toUpperCase() +
      selectedTranslationDisplayMode.value.slice(1)
    }`
  )
);

const restoredReadingProgressPercent = computed(() => {
  if (props.restoredReadingProgress === null || props.restoredReadingProgress === undefined) {
    return null;
  }

  if (!Number.isFinite(props.restoredReadingProgress)) return null;

  return Math.min(100, Math.max(0, Math.round(props.restoredReadingProgress)));
});

const hasRestoredReadingPosition = computed(
  () =>
    props.isReadingMode &&
    restoredReadingProgressPercent.value !== null &&
    restoredReadingProgressPercent.value > 0
);

const readerMoreMenuStyle = computed(() => ({
  left: `${readerMorePosition.value.left}px`,
  top: `${readerMorePosition.value.top}px`,
}));

async function copyLink(article: Article) {
  const success = await copyArticleLink(article.url);
  if (success) {
    window.showToast(t('common.toast.copiedToClipboard'), 'success');
  }
}

function openReaderAppearance(): void {
  isReaderAppearanceOpen.value = true;
}

function focusReadingModeEntry(): void {
  const isDesktop = window.matchMedia?.('(min-width: 768px)').matches;
  const fallback = isDesktop ? closeArticleTrigger.value : mobileBackTrigger.value;
  (readingModeEntryTrigger.value || fallback)?.focus({ preventScroll: true });
}

defineExpose({ focusReadingModeEntry });

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function updateReaderMorePosition(): void {
  if (!isReaderMoreOpen.value) return;

  const triggerRect = readerMoreTrigger.value?.getBoundingClientRect();
  if (!triggerRect) return;

  const menuRect = readerMoreMenu.value?.getBoundingClientRect();
  const menuWidth = menuRect?.width || 272;
  const menuHeight = menuRect?.height || 360;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const margin = 8;
  const left = clamp(triggerRect.right - menuWidth, margin, viewportWidth - menuWidth - margin);
  const below = triggerRect.bottom + margin;
  const top =
    below + menuHeight <= viewportHeight - margin
      ? below
      : clamp(triggerRect.top - menuHeight - margin, margin, viewportHeight - menuHeight - margin);

  readerMorePosition.value = { left, top };
}

function openReaderMore(): void {
  isReaderMoreOpen.value = true;
  void nextTick(() => {
    updateReaderMorePosition();
    getReaderMoreMenuItems()[0]?.focus({ preventScroll: true });
  });
}

function closeReaderMore(restoreFocus = false): void {
  const wasOpen = isReaderMoreOpen.value;
  isReaderMoreOpen.value = false;

  if (restoreFocus && wasOpen) {
    void nextTick(() => readerMoreTrigger.value?.focus({ preventScroll: true }));
  }
}

function toggleReaderMore(): void {
  if (isReaderMoreOpen.value) {
    closeReaderMore();
    return;
  }

  openReaderMore();
}

function selectTranslationDisplayMode(mode: TranslationDisplayMode): void {
  emit('setTranslationDisplayMode', mode);
  closeReaderMore(true);
}

function getReaderMoreMenuItems(): HTMLButtonElement[] {
  if (!readerMoreMenu.value) return [];

  return Array.from(readerMoreMenu.value.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]'));
}

function focusReaderMoreMenuItem(index: number): void {
  const items = getReaderMoreMenuItems();
  if (items.length === 0) return;

  const normalizedIndex = ((index % items.length) + items.length) % items.length;
  items[normalizedIndex]?.focus({ preventScroll: true });
}

function handleReaderMorePointerDown(event: PointerEvent): void {
  if (!isReaderMoreOpen.value) return;

  const target = event.target;
  if (!(target instanceof Node)) return;
  if (readerMoreTrigger.value?.contains(target) || readerMoreMenu.value?.contains(target)) return;

  closeReaderMore();
}

function handleReaderMoreKeydown(event: KeyboardEvent): void {
  if (!isReaderMoreOpen.value) return;

  const items = getReaderMoreMenuItems();
  const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);

  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      event.stopImmediatePropagation();
      closeReaderMore(true);
      break;
    case 'ArrowDown':
      event.preventDefault();
      event.stopPropagation();
      focusReaderMoreMenuItem(activeIndex + 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      event.stopPropagation();
      focusReaderMoreMenuItem(activeIndex - 1);
      break;
    case 'Home':
      event.preventDefault();
      event.stopPropagation();
      focusReaderMoreMenuItem(0);
      break;
    case 'End':
      event.preventDefault();
      event.stopPropagation();
      focusReaderMoreMenuItem(-1);
      break;
  }
}

async function closeReaderAppearance(restoreFocus = true): Promise<void> {
  const wasOpen = isReaderAppearanceOpen.value;
  isReaderAppearanceOpen.value = false;
  await flushSave();

  if (restoreFocus && wasOpen) {
    await nextTick();
    appearanceTrigger.value?.focus({ preventScroll: true });
  }
}

watch(
  () => [props.isReadingMode, props.hasReaderContent],
  ([isReadingMode, hasReaderContent]) => {
    if (!isReadingMode || !hasReaderContent) {
      void closeReaderAppearance(false);
    }

    if (!isReadingMode) {
      closeReaderMore(false);
    }
  }
);

watch(
  () => props.showContents,
  (isOpen, wasOpen) => {
    if (!isOpen && wasOpen && props.restoreContentsFocus) {
      void nextTick(() => readerContentsTrigger.value?.focus({ preventScroll: true }));
    }
  }
);

onMounted(() => {
  document.addEventListener('pointerdown', handleReaderMorePointerDown, true);
  window.addEventListener('keydown', handleReaderMoreKeydown, true);
  window.addEventListener('resize', updateReaderMorePosition);
  window.addEventListener('scroll', updateReaderMorePosition, true);
});

onBeforeUnmount(() => {
  void flushSave();
  document.removeEventListener('pointerdown', handleReaderMorePointerDown, true);
  window.removeEventListener('keydown', handleReaderMoreKeydown, true);
  window.removeEventListener('resize', updateReaderMorePosition);
  window.removeEventListener('scroll', updateReaderMorePosition, true);
});
</script>

<template>
  <div class="article-toolbar-shell">
    <div class="article-toolbar app-panel-header">
      <!-- Modal mode: X button always visible -->
      <button
        v-if="isModal"
        class="ui-button ui-button--ghost"
        :title="t('common.close')"
        @click="$emit('close')"
      >
        <PhX :size="20" class="sm:w-5 sm:h-5" />
      </button>
      <!-- Normal mode: Back button on mobile -->
      <button
        v-else-if="!isReadingMode"
        ref="mobileBackTrigger"
        data-testid="mobile-back"
        class="ui-button ui-button--ghost md:hidden"
        :title="t('common.back')"
        :aria-label="t('common.back')"
        @click="$emit('close')"
      >
        <PhArrowLeft :size="18" class="sm:w-5 sm:h-5" />
        <span class="hidden xs:inline">{{ t('common.back') }}</span>
      </button>
      <!-- Normal mode: expose a close action for desktop article and webpage views. -->
      <button
        v-if="!isModal && !isReadingMode"
        ref="closeArticleTrigger"
        data-testid="close-article"
        class="ui-button ui-button--ghost hidden md:inline-flex"
        :title="t('common.close')"
        :aria-label="t('common.close')"
        @click="$emit('close')"
      >
        <PhX :size="20" class="sm:w-5 sm:h-5" />
        <span class="hidden lg:inline">{{ t('common.close') }}</span>
      </button>
      <div class="article-toolbar-actions flex gap-1 sm:gap-2 ml-auto">
        <template v-if="isReadingMode">
          <button
            v-if="!isModal"
            type="button"
            data-testid="reader-exit"
            class="ui-button ui-button--ghost"
            :title="t('article.readingMode.exit')"
            :aria-label="t('article.readingMode.exit')"
            :aria-pressed="true"
            @click="emit('toggleReadingMode')"
          >
            <PhArrowLeft :size="18" aria-hidden="true" />
            <span class="hidden sm:inline">{{ t('article.readingMode.exit') }}</span>
          </button>
          <button
            v-if="hasPreviousArticle"
            type="button"
            data-testid="reader-previous"
            class="ui-icon-button ui-button--ghost hidden lg:inline-flex"
            :title="t('article.navigation.previousArticle')"
            :aria-label="t('article.navigation.previousArticle')"
            @click="emit('navigatePrevious')"
          >
            <PhCaretLeft :size="18" aria-hidden="true" />
          </button>
          <button
            v-if="hasNextArticle"
            type="button"
            data-testid="reader-next"
            class="ui-icon-button ui-button--ghost hidden lg:inline-flex"
            :title="t('article.navigation.nextArticle')"
            :aria-label="t('article.navigation.nextArticle')"
            @click="emit('navigateNext')"
          >
            <PhCaretRight :size="18" aria-hidden="true" />
          </button>
          <button
            v-if="showContent && hasReaderContent"
            type="button"
            data-testid="reader-find"
            class="ui-icon-button ui-button--ghost hidden md:inline-flex"
            :title="t('article.readingMode.find')"
            :aria-label="t('article.readingMode.find')"
            @click="emit('openFind')"
          >
            <PhMagnifyingGlass :size="18" aria-hidden="true" />
          </button>
          <button
            v-if="showContent && hasReaderContent"
            ref="readerContentsTrigger"
            type="button"
            data-testid="reader-contents"
            class="ui-icon-button ui-button--ghost"
            :class="{ 'ui-button--active': showContents }"
            :title="t('article.readingMode.contents')"
            :aria-label="t('article.readingMode.contents')"
            aria-controls="reader-contents"
            :aria-expanded="showContents"
            @click="emit('toggleContents')"
          >
            <PhListBullets :size="18" aria-hidden="true" />
          </button>
          <button
            v-if="showContent && hasReaderContent"
            ref="appearanceTrigger"
            type="button"
            data-testid="reader-appearance-trigger"
            class="ui-icon-button ui-button--ghost hidden md:inline-flex"
            :title="t('article.readingMode.appearance')"
            :aria-label="t('article.readingMode.appearance')"
            aria-controls="reader-appearance-panel"
            :aria-expanded="isReaderAppearanceOpen"
            @click="openReaderAppearance"
          >
            <PhTextAa :size="18" aria-hidden="true" />
          </button>
          <button
            ref="readerMoreTrigger"
            type="button"
            data-testid="reader-more-trigger"
            class="ui-icon-button ui-button--ghost"
            :class="{ 'ui-button--active': isReaderMoreOpen }"
            :title="t('article.readingMode.moreActions')"
            :aria-label="t('article.readingMode.moreActions')"
            aria-controls="reader-more-menu"
            :aria-expanded="isReaderMoreOpen"
            @click="toggleReaderMore"
          >
            <PhDotsThree :size="18" aria-hidden="true" />
          </button>
          <span
            v-if="settings.translation_enabled && showContent"
            data-testid="reader-translation-state"
            class="hidden md:inline-flex min-w-0 max-w-28 truncate text-xs text-text-secondary"
            role="status"
            aria-live="polite"
            :title="
              t('article.readingMode.translationCurrent', {
                mode: selectedTranslationDisplayModeLabel,
              })
            "
          >
            {{ selectedTranslationDisplayModeLabel }}
          </span>
          <button
            v-if="hasRestoredReadingPosition"
            type="button"
            data-testid="reader-resume-status"
            class="ui-icon-button ui-button--ghost hidden md:inline-flex"
            :title="t('article.readingMode.resumedAt', { percent: restoredReadingProgressPercent })"
            :aria-label="
              t('article.readingMode.resumedAt', { percent: restoredReadingProgressPercent })
            "
            @click="emit('scrollToTop')"
          >
            <PhArrowLineUp :size="18" aria-hidden="true" />
            <span class="sr-only">{{ t('article.readingMode.contentsTop') }}</span>
          </button>
          <span
            v-if="hasReadingProgress"
            data-testid="reading-progress"
            class="min-w-10 text-right text-xs tabular-nums text-text-secondary"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="readingProgressPercent"
            :aria-valuetext="t('article.readingMode.progress', { percent: readingProgressPercent })"
          >
            {{ readingProgressPercent }}%
          </span>
        </template>

        <template v-else>
          <button
            class="ui-icon-button ui-button--ghost"
            :title="
              showContent ? t('article.action.viewOriginal') : t('article.action.viewContent')
            "
            @click="emit('toggleContentView')"
          >
            <PhGlobe v-if="showContent" :size="18" class="sm:w-5 sm:h-5" />
            <PhArticle v-else :size="18" class="sm:w-5 sm:h-5" />
          </button>
          <button
            v-if="showContent && !isModal"
            ref="readingModeEntryTrigger"
            data-testid="toggle-reading-mode"
            class="ui-icon-button ui-button--ghost"
            :title="t('article.readingMode.enter')"
            :aria-label="t('article.readingMode.enter')"
            :aria-pressed="false"
            @click="emit('toggleReadingMode')"
          >
            <PhBookOpen :size="18" class="sm:w-5 sm:h-5" />
          </button>
          <button
            v-if="showContent && settings.translation_enabled && !settings.translation_only_mode"
            class="ui-icon-button ui-button--ghost"
            :title="
              showTranslations
                ? t('setting.reading.hideTranslations')
                : t('setting.reading.showTranslations')
            "
            @click="emit('toggleTranslations')"
          >
            <PhTranslate
              :size="18"
              class="sm:w-5 sm:h-5"
              :weight="showTranslations ? 'fill' : 'regular'"
            />
          </button>
          <button
            class="ui-icon-button ui-button--ghost"
            :title="
              article.is_read ? t('article.action.markAsUnread') : t('article.action.markAsRead')
            "
            @click="emit('toggleRead')"
          >
            <PhEnvelopeOpen v-if="article.is_read" :size="18" class="sm:w-5 sm:h-5" />
            <PhEnvelope v-else :size="18" class="sm:w-5 sm:h-5" />
          </button>
          <button
            :class="[
              'ui-icon-button ui-button--ghost',
              article.is_favorite ? 'state-favorite-action' : 'state-favorite-hover',
            ]"
            :title="
              article.is_favorite
                ? t('article.action.removeFromFavorite')
                : t('article.toolbar.addToFavorite')
            "
            @click="emit('toggleFavorite')"
          >
            <PhStar
              :size="18"
              class="sm:w-5 sm:h-5"
              :weight="article.is_favorite ? 'fill' : 'regular'"
            />
          </button>
          <button
            :class="[
              'ui-icon-button ui-button--ghost',
              article.is_read_later ? 'state-read-later-action' : 'state-read-later-hover',
            ]"
            :title="
              article.is_read_later
                ? t('article.action.removeFromReadLater')
                : t('article.toolbar.addToReadLater')
            "
            @click="emit('toggleReadLater')"
          >
            <PhClockCountdown
              :size="18"
              class="sm:w-5 sm:h-5"
              :weight="article.is_read_later ? 'fill' : 'regular'"
            />
          </button>
          <button
            class="ui-icon-button ui-button--ghost"
            :title="t('article.action.openInBrowser')"
            @click="emit('openOriginal')"
          >
            <PhArrowSquareOut :size="18" class="sm:w-5 sm:h-5" />
          </button>
          <button
            class="ui-icon-button ui-button--ghost"
            :title="t('common.contextMenu.copyLink')"
            @click="copyLink(article)"
          >
            <PhLinkSimple :size="18" class="sm:w-5 sm:h-5" />
          </button>
          <button
            class="ui-icon-button ui-button--ghost"
            :title="t('article.action.reloadContent')"
            @click="emit('reloadContent')"
          >
            <PhArrowClockwise :size="18" class="sm:w-5 sm:h-5" />
          </button>
          <button
            v-if="settings.obsidian_enabled"
            class="ui-icon-button ui-button--ghost"
            :title="t('setting.plugins.obsidian.exportTo')"
            @click="emit('exportToObsidian')"
          >
            <img
              src="/assets/plugin_icons/obsidian.svg"
              class="w-[18px] h-[18px] sm:w-5 sm:h-5"
              alt="Obsidian"
            />
          </button>
          <button
            v-if="settings.notion_enabled"
            class="ui-icon-button ui-button--ghost"
            :title="t('setting.plugins.notion.exportTo')"
            @click="emit('exportToNotion')"
          >
            <img
              src="/assets/plugin_icons/notion.svg"
              class="w-[18px] h-[18px] sm:w-5 sm:h-5"
              alt="Notion"
            />
          </button>
          <button
            v-if="settings.zotero_enabled"
            class="ui-icon-button ui-button--ghost"
            :title="t('setting.plugins.zotero.exportTo')"
            @click="emit('exportToZotero')"
          >
            <img
              src="/assets/plugin_icons/zotero.png"
              class="w-[18px] h-[18px] sm:w-5 sm:h-5"
              alt="Zotero"
            />
          </button>
        </template>
      </div>
    </div>
    <div
      v-if="hasReadingProgress"
      data-testid="reading-progress-track"
      class="reading-progress-track"
      aria-hidden="true"
    >
      <div
        data-testid="reading-progress-fill"
        class="reading-progress-fill"
        :style="{ transform: `scaleX(${readingProgressPercent / 100})` }"
      ></div>
    </div>
    <ReaderAppearancePanel
      v-if="isReaderAppearanceOpen"
      :anchor="appearanceTrigger"
      :settings="settings"
      :save-error="saveError"
      :save-state="saveState"
      @close="closeReaderAppearance"
      @select-preset="applyPreset"
      @update-typography="updateTypography"
      @update-canvas="updateCanvas"
      @restore-default-typography="restoreDefaultTypography"
      @retry-save="retrySave"
    />
  </div>

  <Teleport to="body">
    <section
      v-if="isReaderMoreOpen"
      id="reader-more-menu"
      ref="readerMoreMenu"
      class="reader-more-menu"
      :style="readerMoreMenuStyle"
      role="menu"
      :aria-label="t('article.readingMode.moreActions')"
    >
      <template v-if="hasPreviousArticle || hasNextArticle">
        <button
          v-if="hasPreviousArticle"
          type="button"
          role="menuitem"
          data-testid="reader-menu-previous"
          class="reader-more-menu-item"
          @click="
            emit('navigatePrevious');
            closeReaderMore();
          "
        >
          <PhCaretLeft :size="18" aria-hidden="true" />
          <span>{{ t('article.navigation.previousArticle') }}</span>
        </button>
        <button
          v-if="hasNextArticle"
          type="button"
          role="menuitem"
          data-testid="reader-menu-next"
          class="reader-more-menu-item"
          @click="
            emit('navigateNext');
            closeReaderMore();
          "
        >
          <PhCaretRight :size="18" aria-hidden="true" />
          <span>{{ t('article.navigation.nextArticle') }}</span>
        </button>
        <div class="reader-more-menu-separator" role="separator"></div>
      </template>
      <template v-if="showContent && hasReaderContent">
        <button
          type="button"
          role="menuitem"
          data-testid="reader-menu-find"
          class="reader-more-menu-item"
          @click="
            emit('openFind');
            closeReaderMore();
          "
        >
          <PhMagnifyingGlass :size="18" aria-hidden="true" />
          <span>{{ t('article.readingMode.find') }}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="reader-menu-appearance"
          class="reader-more-menu-item"
          @click="
            openReaderAppearance();
            closeReaderMore();
          "
        >
          <PhTextAa :size="18" aria-hidden="true" />
          <span>{{ t('article.readingMode.appearance') }}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="reader-menu-top"
          class="reader-more-menu-item"
          @click="
            emit('scrollToTop');
            closeReaderMore(true);
          "
        >
          <PhArrowLineUp :size="18" aria-hidden="true" />
          <span>{{ t('article.readingMode.contentsTop') }}</span>
        </button>
        <div class="reader-more-menu-separator" role="separator"></div>
      </template>
      <button
        type="button"
        role="menuitem"
        class="reader-more-menu-item"
        @click="
          emit('toggleContentView');
          closeReaderMore();
        "
      >
        <PhGlobe v-if="showContent" :size="18" aria-hidden="true" />
        <PhArticle v-else :size="18" aria-hidden="true" />
        <span>{{
          showContent ? t('article.action.viewOriginal') : t('article.action.viewContent')
        }}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-testid="reader-menu-toggle-read"
        class="reader-more-menu-item"
        @click="
          emit('toggleRead');
          closeReaderMore();
        "
      >
        <PhEnvelopeOpen v-if="article.is_read" :size="18" aria-hidden="true" />
        <PhEnvelope v-else :size="18" aria-hidden="true" />
        <span>{{
          article.is_read ? t('article.action.markAsUnread') : t('article.action.markAsRead')
        }}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="reader-more-menu-item"
        @click="
          emit('toggleFavorite');
          closeReaderMore();
        "
      >
        <PhStar :size="18" :weight="article.is_favorite ? 'fill' : 'regular'" aria-hidden="true" />
        <span>{{
          article.is_favorite
            ? t('article.action.removeFromFavorite')
            : t('article.toolbar.addToFavorite')
        }}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="reader-more-menu-item"
        @click="
          emit('toggleReadLater');
          closeReaderMore();
        "
      >
        <PhClockCountdown
          :size="18"
          :weight="article.is_read_later ? 'fill' : 'regular'"
          aria-hidden="true"
        />
        <span>{{
          article.is_read_later
            ? t('article.action.removeFromReadLater')
            : t('article.toolbar.addToReadLater')
        }}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="reader-more-menu-item"
        @click="
          emit('openOriginal');
          closeReaderMore();
        "
      >
        <PhArrowSquareOut :size="18" aria-hidden="true" />
        <span>{{ t('article.action.openInBrowser') }}</span>
      </button>

      <template v-if="settings.translation_enabled && showContent">
        <div class="reader-more-menu-separator" role="separator"></div>
        <p class="reader-more-menu-label">{{ t('article.readingMode.translationDisplay') }}</p>
        <button
          v-for="mode in translationDisplayModes"
          :key="mode"
          type="button"
          role="menuitemradio"
          class="reader-more-menu-item reader-more-menu-item--radio"
          :data-testid="`reader-translation-${mode}`"
          :aria-checked="selectedTranslationDisplayMode === mode"
          @click="selectTranslationDisplayMode(mode)"
        >
          <span>{{
            t(`article.readingMode.translation${mode[0].toUpperCase()}${mode.slice(1)}`)
          }}</span>
          <PhCheck v-if="selectedTranslationDisplayMode === mode" :size="16" aria-hidden="true" />
        </button>
      </template>
    </section>
  </Teleport>
</template>

<style scoped>
@reference "../../style.css";
.article-toolbar-shell {
  @apply shrink-0 bg-bg-primary;
}

.article-toolbar > button {
  flex: 0 0 auto;
}

.article-toolbar-actions {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  overscroll-behavior-inline: contain;
}

.article-toolbar-actions::-webkit-scrollbar {
  display: none;
}

.reading-progress-track {
  height: 2px;
  background-color: var(--border-color);
}

.reading-progress-fill {
  height: 100%;
  background-color: var(--accent-color);
  transform-origin: left center;
  transition: transform 160ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .reading-progress-fill {
    transition: none;
  }
}

.reading-toolbar-divider {
  width: 1px;
  height: 20px;
  margin-inline: 0.25rem;
  flex: 0 0 1px;
  background-color: var(--border-color);
}

.reader-more-menu {
  position: fixed;
  z-index: 70;
  width: min(17rem, calc(100vw - 1rem));
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: 0.625rem;
  background-color: var(--bg-primary);
  box-shadow: 0 4px 8px color-mix(in srgb, var(--overlay-shadow-color, #000) 20%, transparent);
}

.reader-more-menu-item {
  display: flex;
  width: 100%;
  min-height: var(--ui-control-height);
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  color: var(--text-primary);
  font-size: calc(0.875rem * var(--ui-font-scale, 1));
  font-weight: 500;
  line-height: 1.25;
  text-align: left;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.reader-more-menu-item:hover,
.reader-more-menu-item:focus-visible {
  background-color: var(--bg-tertiary);
}

.reader-more-menu-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.reader-more-menu-item--radio {
  justify-content: space-between;
  color: var(--text-secondary);
}

.reader-more-menu-item--radio[aria-checked='true'] {
  color: var(--accent-text-color);
}

.reader-more-menu-separator {
  height: 1px;
  margin: 0.375rem 0;
  background-color: var(--border-color);
}

.reader-more-menu-label {
  margin: 0.5rem 0.625rem 0.25rem;
  color: var(--text-secondary);
  font-size: calc(0.75rem * var(--ui-font-scale, 1));
  font-weight: 600;
}

@media (max-width: 639px) {
  .article-toolbar-actions {
    justify-content: flex-start;
    margin-left: 0.25rem;
  }
}

.state-favorite-action,
.state-favorite-hover:hover {
  color: var(--state-favorite-color);
}

.state-read-later-action,
.state-read-later-hover:hover {
  color: var(--state-read-later-color);
}
</style>
