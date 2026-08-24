<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSettings } from '@/composables/core/useSettings';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useReaderTypographyPreferences } from '@/composables/article/useReaderTypographyPreferences';
import { useAppStore } from '@/stores/app';
import ReaderAppearancePanel from './ReaderAppearancePanel.vue';
import {
  PhArrowLeft,
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
} from '@phosphor-icons/vue';
import type { Article } from '@/types/models';
import { copyArticleLink } from '@/utils/clipboard';

const { t } = useI18n();
const { settings, fetchSettings } = useSettings();
const store = useAppStore();
const appearanceTrigger = ref<HTMLButtonElement | null>(null);
const isReaderAppearanceOpen = ref(false);
const { applyPreset, applyThemeRecommendation, flushSave, retrySave, saveError, updateTypography } =
  useReaderTypographyPreferences({ settings });

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
  isModal?: boolean;
  isReadingMode?: boolean;
  readingProgress?: number;
  hasReaderContent?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTranslations: true,
  isModal: false,
  isReadingMode: false,
  readingProgress: 0,
  hasReaderContent: false,
});

defineEmits<{
  close: [];
  toggleContentView: [];
  toggleReadingMode: [];
  toggleRead: [];
  toggleFavorite: [];
  toggleReadLater: [];
  openOriginal: [];
  toggleTranslations: [];
  reloadContent: [];
  exportToObsidian: [];
  exportToNotion: [];
  exportToZotero: [];
}>();

const readingProgressPercent = computed(() => {
  const progress = Number(props.readingProgress);
  if (!Number.isFinite(progress)) return 0;

  return Math.min(100, Math.max(0, Math.round(progress)));
});

async function copyLink(article: Article) {
  const success = await copyArticleLink(article.url);
  if (success) {
    window.showToast(t('common.toast.copiedToClipboard'), 'success');
  }
}

function openReaderAppearance(): void {
  isReaderAppearanceOpen.value = true;
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
  }
);

onBeforeUnmount(() => {
  void flushSave();
});
</script>

<template>
  <div class="article-toolbar-shell">
    <div
      :class="[
        'article-toolbar border-b border-border flex justify-between items-center bg-bg-primary shrink-0',
        isReadingMode ? 'p-2' : 'p-2 sm:p-4',
      ]"
    >
      <!-- Modal mode: X button always visible -->
      <button
        v-if="isModal"
        class="flex items-center gap-1.5 sm:gap-2 text-text-secondary hover:text-text-primary text-sm sm:text-base"
        :title="t('common.close')"
        @click="$emit('close')"
      >
        <PhX :size="20" class="sm:w-5 sm:h-5" />
      </button>
      <!-- Normal mode: Back button on mobile -->
      <button
        v-else-if="!isReadingMode"
        data-testid="mobile-back"
        class="md:hidden flex items-center gap-1.5 sm:gap-2 text-text-secondary hover:text-text-primary text-sm sm:text-base"
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
        data-testid="close-article"
        class="hidden md:flex items-center gap-1.5 sm:gap-2 text-text-secondary hover:text-text-primary text-sm sm:text-base"
        :title="t('common.close')"
        :aria-label="t('common.close')"
        @click="$emit('close')"
      >
        <PhX :size="20" class="sm:w-5 sm:h-5" />
        <span class="hidden lg:inline">{{ t('common.close') }}</span>
      </button>
      <div class="article-toolbar-actions flex gap-1 sm:gap-2 ml-auto">
        <button
          class="action-btn"
          :title="showContent ? t('article.action.viewOriginal') : t('article.action.viewContent')"
          @click="$emit('toggleContentView')"
        >
          <PhGlobe v-if="showContent" :size="18" class="sm:w-5 sm:h-5" />
          <PhArticle v-else :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="showContent && !isModal"
          data-testid="toggle-reading-mode"
          class="action-btn"
          :title="isReadingMode ? t('article.readingMode.exit') : t('article.readingMode.enter')"
          :aria-label="
            isReadingMode ? t('article.readingMode.exit') : t('article.readingMode.enter')
          "
          :aria-pressed="isReadingMode"
          @click="$emit('toggleReadingMode')"
        >
          <PhBookOpen
            :size="18"
            class="sm:w-5 sm:h-5"
            :weight="isReadingMode ? 'fill' : 'regular'"
          />
        </button>
        <span
          v-if="isReadingMode"
          data-testid="reading-toolbar-divider"
          class="reading-toolbar-divider"
          aria-hidden="true"
        ></span>
        <button
          v-if="showContent && isReadingMode && hasReaderContent"
          ref="appearanceTrigger"
          type="button"
          data-testid="reader-appearance-trigger"
          class="action-btn"
          :title="t('article.readingMode.appearance')"
          :aria-label="t('article.readingMode.appearance')"
          aria-controls="reader-appearance-panel"
          :aria-expanded="isReaderAppearanceOpen"
          @click="openReaderAppearance"
        >
          <PhTextAa :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="
            !isReadingMode &&
            showContent &&
            settings.translation_enabled &&
            !settings.translation_only_mode
          "
          class="action-btn"
          :title="
            showTranslations
              ? t('setting.reading.hideTranslations')
              : t('setting.reading.showTranslations')
          "
          @click="$emit('toggleTranslations')"
        >
          <PhTranslate
            :size="18"
            class="sm:w-5 sm:h-5"
            :weight="showTranslations ? 'fill' : 'regular'"
          />
        </button>
        <button
          class="action-btn"
          :title="
            article.is_read ? t('article.action.markAsUnread') : t('article.action.markAsRead')
          "
          @click="$emit('toggleRead')"
        >
          <PhEnvelopeOpen v-if="article.is_read" :size="18" class="sm:w-5 sm:h-5" />
          <PhEnvelope v-else :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          :class="[
            'action-btn',
            article.is_favorite ? 'state-favorite-action' : 'state-favorite-hover',
          ]"
          :title="
            article.is_favorite
              ? t('article.action.removeFromFavorite')
              : t('article.toolbar.addToFavorite')
          "
          @click="$emit('toggleFavorite')"
        >
          <PhStar
            :size="18"
            class="sm:w-5 sm:h-5"
            :weight="article.is_favorite ? 'fill' : 'regular'"
          />
        </button>
        <button
          :class="[
            'action-btn',
            article.is_read_later ? 'state-read-later-action' : 'state-read-later-hover',
          ]"
          :title="
            article.is_read_later
              ? t('article.action.removeFromReadLater')
              : t('article.toolbar.addToReadLater')
          "
          @click="$emit('toggleReadLater')"
        >
          <PhClockCountdown
            :size="18"
            class="sm:w-5 sm:h-5"
            :weight="article.is_read_later ? 'fill' : 'regular'"
          />
        </button>
        <button
          class="action-btn"
          :title="t('article.action.openInBrowser')"
          @click="$emit('openOriginal')"
        >
          <PhArrowSquareOut :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="!isReadingMode"
          class="action-btn"
          :title="t('common.contextMenu.copyLink')"
          @click="copyLink(article)"
        >
          <PhLinkSimple :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="!isReadingMode"
          class="action-btn"
          :title="t('article.action.reloadContent')"
          @click="$emit('reloadContent')"
        >
          <PhArrowClockwise :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="!isReadingMode && settings.obsidian_enabled"
          class="action-btn"
          :title="t('setting.plugins.obsidian.exportTo')"
          @click="$emit('exportToObsidian')"
        >
          <img
            src="/assets/plugin_icons/obsidian.svg"
            class="w-[18px] h-[18px] sm:w-5 sm:h-5"
            alt="Obsidian"
          />
        </button>
        <button
          v-if="!isReadingMode && settings.notion_enabled"
          class="action-btn"
          :title="t('setting.plugins.notion.exportTo')"
          @click="$emit('exportToNotion')"
        >
          <img
            src="/assets/plugin_icons/notion.svg"
            class="w-[18px] h-[18px] sm:w-5 sm:h-5"
            alt="Notion"
          />
        </button>
        <button
          v-if="!isReadingMode && settings.zotero_enabled"
          class="action-btn"
          :title="t('setting.plugins.zotero.exportTo')"
          @click="$emit('exportToZotero')"
        >
          <img
            src="/assets/plugin_icons/zotero.png"
            class="w-[18px] h-[18px] sm:w-5 sm:h-5"
            alt="Zotero"
          />
        </button>
        <span
          v-if="isReadingMode"
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
      </div>
    </div>
    <div
      v-if="isReadingMode"
      data-testid="reading-progress-track"
      class="reading-progress-track"
      aria-hidden="true"
    >
      <div
        data-testid="reading-progress-fill"
        class="reading-progress-fill"
        :style="{ width: `${readingProgressPercent}%` }"
      ></div>
    </div>
    <ReaderAppearancePanel
      v-if="isReaderAppearanceOpen"
      :anchor="appearanceTrigger"
      :settings="settings"
      :theme-preset="store.theme"
      :save-error="saveError"
      @close="closeReaderAppearance"
      @select-preset="applyPreset"
      @update-typography="updateTypography"
      @restore-theme-recommendation="applyThemeRecommendation(store.theme)"
      @retry-save="retrySave"
    />
  </div>
</template>

<style scoped>
@reference "../../style.css";
.action-btn {
  @apply text-lg sm:text-xl cursor-pointer text-text-secondary rounded-md transition-colors hover:bg-bg-tertiary hover:text-text-primary;
  min-width: 44px;
  min-height: 44px;
  padding: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
}

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
  transition: width 160ms ease-out;
}

.reading-toolbar-divider {
  width: 1px;
  height: 20px;
  margin-inline: 0.25rem;
  flex: 0 0 1px;
  background-color: var(--border-color);
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
