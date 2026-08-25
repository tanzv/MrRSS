<script setup lang="ts">
import { PhArrowLeft, PhNewspaper, PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue';
import { useArticleDetail } from '@/composables/article/useArticleDetail';
import { useAppStore } from '@/stores/app';
import ArticleToolbar from './ArticleToolbar.vue';
import ArticleContent from './ArticleContent.vue';
import ImageViewer from '../common/ImageViewer.vue';
import FindInPage from '../common/FindInPage.vue';

import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';

const store = useAppStore();

const {
  article,
  showContent,
  articleContent,
  isLoadingContent,
  imageViewerSrc,
  imageViewerAlt,
  imageViewerImages,
  imageViewerInitialIndex,
  hasPreviousArticle,
  hasNextArticle,
  nextArticle,
  close,
  toggleRead,
  toggleFavorite,
  toggleReadLater,
  openOriginal,
  toggleContentView,
  toggleReadingMode,
  reloadArticleContent,
  closeImageViewer,
  attachImageEventListeners,
  exportToObsidian,
  exportToNotion,
  exportToZotero,
  handleRetryLoadContent,
  handleReadingProgress,
  goToPreviousArticle,
  goToNextArticle,
  t,
} = useArticleDetail();

const showTranslations = ref(true);
const showFindInPage = ref(false);
const readingProgress = ref(0);
const readingModeAnnouncement = ref('');
const readerLinkUrl = ref<string | null>(null);
const readerLinkReturnFocusTarget = ref<HTMLElement | null>(null);
const returnToReadingButton = ref<HTMLButtonElement | null>(null);
const hasReaderContent = computed(
  () => !isLoadingContent.value && Boolean(articleContent.value.trim())
);

watch(
  () => store.isReadingMode,
  (isReadingMode) => {
    readingModeAnnouncement.value = isReadingMode
      ? t('article.readingMode.entered')
      : t('article.readingMode.exited');
  }
);

watch(
  () => article.value?.id,
  () => {
    readingProgress.value = 0;
    closeReaderLink({ restoreFocus: false });
  }
);

function toggleTranslations() {
  showTranslations.value = !showTranslations.value;
}

function openFindInPage() {
  showFindInPage.value = true;
}

function closeFindInPage() {
  showFindInPage.value = false;
}

function openReaderLink(url: string): void {
  const activeElement = document.activeElement;
  readerLinkReturnFocusTarget.value = activeElement instanceof HTMLElement ? activeElement : null;
  showFindInPage.value = false;
  readerLinkUrl.value = url;
  void nextTick(() => returnToReadingButton.value?.focus());
}

function closeReaderLink({ restoreFocus = true }: { restoreFocus?: boolean } = {}): void {
  readerLinkUrl.value = null;
  const returnFocusTarget = readerLinkReturnFocusTarget.value;
  readerLinkReturnFocusTarget.value = null;

  if (restoreFocus && returnFocusTarget?.isConnected) {
    void nextTick(() => returnFocusTarget.focus());
  }
}

function closeReaderLinkOnEscape(event: KeyboardEvent): boolean {
  if (!readerLinkUrl.value || event.key !== 'Escape') return false;

  event.preventDefault();
  event.stopImmediatePropagation();
  closeReaderLink();
  return true;
}

function handleReaderLinkPreviewKeydown(event: KeyboardEvent): void {
  closeReaderLinkOnEscape(event);
}

function handleReaderLinkPreviewLoad(event: Event): void {
  const iframe = event.currentTarget;
  if (!(iframe instanceof HTMLIFrameElement)) return;

  try {
    const frameWindow = iframe.contentWindow;
    frameWindow?.removeEventListener('keydown', handleReaderLinkPreviewKeydown, true);
    frameWindow?.addEventListener('keydown', handleReaderLinkPreviewKeydown, true);
  } catch {
    // A navigation outside the local proxy cannot expose its window to the parent.
  }
}

function onReadingProgress(percent: number): void {
  readingProgress.value = percent;
  void handleReadingProgress(percent)?.catch((error) =>
    console.error('Error updating article read state:', error)
  );
}

function handleKeydown(e: KeyboardEvent) {
  if (closeReaderLinkOnEscape(e)) return;

  // Open find in page with Ctrl+F or Cmd+F
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    // Only if we're showing an article in content mode (not webpage view)
    if (article.value && showContent.value) {
      e.preventDefault();
      openFindInPage();
    }
  }

  // Note: FindInPage component handles its own ESC key to close
  // We don't handle ESC here to avoid conflicts - FindInPage will stopPropagation
  // when it needs to handle the key (when search is focused or has content)

  // Note: Arrow key navigation is now handled by the global keyboard shortcuts system
  // See useKeyboardShortcuts.ts which properly checks for editable elements
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <main
    :class="[
      'flex-1 bg-bg-primary flex flex-col h-full absolute w-full md:static md:w-auto z-30 transition-transform duration-300',
      article ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
    ]"
  >
    <span class="sr-only" aria-live="polite">{{ readingModeAnnouncement }}</span>

    <div
      v-if="!article"
      class="hidden md:flex flex-col items-center justify-center h-full text-text-secondary text-center px-4"
    >
      <PhNewspaper :size="48" class="mb-4 sm:mb-5 opacity-50 sm:w-16 sm:h-16" />
      <p class="text-sm sm:text-base">{{ t('article.content.selectArticle') }}</p>
    </div>

    <div v-else class="relative flex flex-col h-full bg-bg-primary">
      <div
        data-testid="reader-session-content"
        class="contents"
        :inert="readerLinkUrl ? true : undefined"
        :aria-hidden="readerLinkUrl ? 'true' : undefined"
      >
        <ArticleToolbar
          :article="article"
          :show-content="showContent"
          :show-translations="showTranslations"
          :is-reading-mode="store.isReadingMode"
          :reading-progress="readingProgress"
          :has-reader-content="hasReaderContent"
          @close="close"
          @toggle-content-view="toggleContentView"
          @toggle-reading-mode="toggleReadingMode"
          @toggle-read="toggleRead"
          @toggle-favorite="toggleFavorite"
          @toggle-read-later="toggleReadLater"
          @open-original="openOriginal"
          @toggle-translations="toggleTranslations"
          @reload-content="reloadArticleContent"
          @export-to-obsidian="exportToObsidian"
          @export-to-notion="exportToNotion"
          @export-to-zotero="exportToZotero"
        />

        <!-- Original webpage view -->
        <div v-if="!showContent" class="flex-1 bg-bg-primary w-full">
          <iframe
            :key="article.id"
            :src="`/api/webpage/proxy?url=${encodeURIComponent(article.url)}`"
            :title="article.title"
            class="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-popups"
          ></iframe>
        </div>

        <!-- RSS content view -->
        <ArticleContent
          v-else
          :article="article"
          :article-content="articleContent"
          :is-loading-content="isLoadingContent"
          :attach-image-event-listeners="attachImageEventListeners"
          :show-translations="showTranslations"
          :show-content="showContent"
          :is-reading-mode="store.isReadingMode"
          :next-article="nextArticle"
          @retry-load-content="handleRetryLoadContent"
          @reading-progress="onReadingProgress"
          @navigate-next="goToNextArticle"
          @open-link="openReaderLink"
        />

        <!-- Navigation buttons -->
        <div
          v-if="!store.isReadingMode && (hasPreviousArticle || hasNextArticle)"
          data-testid="article-navigation"
          class="flex items-center justify-between bg-bg-primary px-3 py-1.5"
        >
          <button
            v-if="hasPreviousArticle"
            :title="t('article.navigation.previousArticle') || 'Previous article'"
            class="flex items-center gap-1.5 px-2 py-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            @click="goToPreviousArticle"
          >
            <PhCaretLeft :size="16" />
            <span class="text-xs">{{ t('article.navigation.previousArticle') || 'Previous' }}</span>
          </button>

          <div v-else class="w-16"></div>

          <button
            v-if="hasNextArticle"
            :title="t('article.navigation.nextArticle') || 'Next article'"
            class="flex items-center gap-1.5 px-2 py-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            @click="goToNextArticle"
          >
            <span class="text-xs">{{ t('article.navigation.nextArticle') || 'Next' }}</span>
            <PhCaretRight :size="16" />
          </button>

          <div v-else class="w-16"></div>
        </div>
      </div>

      <section
        v-if="readerLinkUrl"
        data-testid="reader-link-preview"
        class="absolute inset-0 z-40 flex flex-col bg-bg-primary"
        role="dialog"
        aria-modal="true"
        :aria-label="t('article.readingMode.linkPreview')"
      >
        <header class="app-panel-header">
          <button
            ref="returnToReadingButton"
            type="button"
            data-testid="return-to-reading"
            class="ui-button ui-button--ghost"
            @click="closeReaderLink"
          >
            <PhArrowLeft :size="18" />
            <span>{{ t('article.readingMode.returnToReading') }}</span>
          </button>
        </header>
        <iframe
          :src="`/api/webpage/proxy?url=${encodeURIComponent(readerLinkUrl)}`"
          :title="t('article.readingMode.linkPreview')"
          class="w-full flex-1 border-none"
          sandbox="allow-scripts allow-same-origin allow-popups"
          @load="handleReaderLinkPreviewLoad"
        ></iframe>
      </section>
    </div>

    <!-- Find in Page (only shown in content mode) -->
    <FindInPage
      v-if="showFindInPage && showContent"
      container-selector=".prose-content"
      :article-id="article?.id"
      @close="closeFindInPage"
    />

    <!-- Image Viewer Modal -->
    <ImageViewer
      v-if="imageViewerSrc"
      :src="imageViewerSrc"
      :alt="imageViewerAlt"
      :images="imageViewerImages"
      :initial-index="imageViewerInitialIndex"
      @close="closeImageViewer"
    />
  </main>
</template>
