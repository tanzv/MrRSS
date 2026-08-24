<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { PhArrowLeft, PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue';
import ArticleToolbar from './ArticleToolbar.vue';
import ArticleContent from './ArticleContent.vue';
import ImageViewer from '../common/ImageViewer.vue';
import FindInPage from '../common/FindInPage.vue';
import type { Article } from '@/types/models';
import { openInBrowser } from '@/utils/browser';
import { useSettings } from '@/composables/core/useSettings';
import { useArticleReadTracking } from '@/composables/article/useArticleReadTracking';

interface Props {
  article: Article;
  articleContent: string;
  isLoadingContent: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  previous: [];
  next: [];
  toggleFavorite: [];
  toggleReadLater: [];
  retryLoadContent: [];
  reloadContent: [];
}>();

const { t } = useI18n();
const store = useAppStore();
const { fetchSettings } = useSettings();
const readTracking = useArticleReadTracking();

// View state
const showContent = ref(true);
const showTranslations = ref(true);
const showFindInPage = ref(false);
const readerLinkUrl = ref<string | null>(null);
const readerLinkReturnFocusTarget = ref<HTMLElement | null>(null);
const returnToReadingButton = ref<HTMLButtonElement | null>(null);

// Image viewer state
const imageViewerSrc = ref<string | null>(null);
const imageViewerAlt = ref('');
const imageViewerImages = ref<string[]>([]);
const imageViewerInitialIndex = ref(0);

// Export to Obsidian
async function exportToObsidian() {
  if (!props.article) return;

  try {
    window.showToast(t('setting.plugins.obsidian.exporting'), 'info');

    const response = await fetch('/api/articles/export/obsidian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: props.article.id,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();

    // Show success message with file path
    const message = data.message || t('setting.plugins.obsidian.exported');
    const filePath = data.file_path ? ` (${data.file_path})` : '';
    window.showToast(message + filePath, 'success');
  } catch (error) {
    console.error('Failed to export to Obsidian:', error);
    const message =
      error instanceof Error ? error.message : t('setting.plugins.obsidian.exportFailed');
    window.showToast(message, 'error');
  }
}

// Export to Notion
async function exportToNotion() {
  if (!props.article) return;

  try {
    window.showToast(t('setting.plugins.notion.exporting'), 'info');

    const response = await fetch('/api/articles/export/notion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: props.article.id,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();

    // Show success message
    const message = data.message || t('setting.plugins.notion.exported');
    window.showToast(message, 'success');

    // Open the Notion page in external browser
    if (data.page_url) {
      openInBrowser(data.page_url);
    }
  } catch (error) {
    console.error('Failed to export to Notion:', error);
    const message =
      error instanceof Error ? error.message : t('setting.plugins.notion.exportFailed');
    window.showToast(message, 'error');
  }
}

// Export to Zotero
async function exportToZotero() {
  if (!props.article) return;

  try {
    window.showToast(t('setting.plugins.zotero.exporting'), 'info');

    const response = await fetch('/api/articles/export/zotero', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: props.article.id,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();

    // Show success message
    const message = data.message || t('setting.plugins.zotero.exported');
    window.showToast(message, 'success');
  } catch (error) {
    console.error('Failed to export to Zotero:', error);
    const message =
      error instanceof Error ? error.message : t('setting.plugins.zotero.exportFailed');
    window.showToast(message, 'error');
  }
}

// Navigation
const currentArticleIndex = computed(() => {
  if (!props.article) return -1;
  return store.articles.findIndex((a) => a.id === props.article.id);
});

const hasPreviousArticle = computed(() => currentArticleIndex.value > 0);
const hasNextArticle = computed(
  () => currentArticleIndex.value >= 0 && currentArticleIndex.value < store.articles.length - 1
);

function resolvePresentation(): void {
  showContent.value = readTracking.getEffectiveViewMode(props.article) === 'rendered';
}

function trackArticleOpened(): void {
  void readTracking
    .handleArticleOpened(props.article, showContent.value ? 'rss' : 'webpage')
    .catch((error) => console.error('Error updating article read state:', error));
}

function handleReadingProgress(percent: number): void {
  if (!showContent.value) return;
  void readTracking
    .handleReadingProgress(props.article, percent)
    .catch((error) => console.error('Error updating article read state:', error));
}

function toggleRead(): void {
  void readTracking
    .setReadState(props.article, !props.article.is_read)
    .catch((error) => console.error('Error updating article read state:', error));
}

// Load default view mode on mount
onMounted(async () => {
  try {
    await fetchSettings();
  } catch (e) {
    console.error('Error loading settings:', e);
  }

  resolvePresentation();
  trackArticleOpened();

  // Add keyboard listener
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});

// Watch for article changes
watch(
  () => props.article?.id,
  () => {
    // Reset image viewer when article changes
    imageViewerSrc.value = null;
    imageViewerAlt.value = '';
    imageViewerImages.value = [];
    imageViewerInitialIndex.value = 0;
    closeReaderLink({ restoreFocus: false });

    resolvePresentation();
    trackArticleOpened();
  }
);

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

function handleKeydown(e: KeyboardEvent) {
  // ESC to close
  if (e.key === 'Escape') {
    if (closeReaderLinkOnEscape(e)) return;

    if (showFindInPage.value) {
      showFindInPage.value = false;
    } else if (imageViewerSrc.value) {
      closeImageViewer();
    } else {
      emit('close');
    }
    return;
  }

  // Ctrl+F to find
  if ((e.ctrlKey || e.metaKey) && e.key === 'f' && showContent.value) {
    e.preventDefault();
    showFindInPage.value = true;
    return;
  }

  // Arrow navigation
  if (e.key === 'ArrowLeft' && hasPreviousArticle.value) {
    emit('previous');
  } else if (e.key === 'ArrowRight' && hasNextArticle.value) {
    emit('next');
  }
}

function toggleContentView() {
  showContent.value = !showContent.value;
  trackArticleOpened();
}

function toggleTranslations() {
  showTranslations.value = !showTranslations.value;
}

function openOriginal() {
  if (props.article?.url) {
    openInBrowser(props.article.url);
  }
}

function closeImageViewer() {
  imageViewerSrc.value = null;
  imageViewerAlt.value = '';
  imageViewerImages.value = [];
  imageViewerInitialIndex.value = 0;
}

// Attach image event listeners for the image viewer
function attachImageEventListeners() {
  setTimeout(() => {
    const contentEl = document.querySelector('.modal-prose-content');
    if (!contentEl) return;

    const images = contentEl.querySelectorAll('img');
    const allImages: string[] = [];

    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src) {
        allImages.push(src);
      }
    });

    images.forEach((img, index) => {
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => {
        const src = img.getAttribute('src');
        if (src) {
          imageViewerSrc.value = src;
          imageViewerAlt.value = img.getAttribute('alt') || '';
          imageViewerImages.value = allImages;
          imageViewerInitialIndex.value = index;
        }
      });
    });
  }, 100);
}

function handleRetryLoadContent() {
  emit('retryLoadContent');
}

function handleReloadContent() {
  emit('reloadContent');
}

function handleOverlayClick(e: MouseEvent) {
  // Only close if clicking directly on the overlay, not its children
  if (e.target === e.currentTarget) {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="article-modal-overlay" @click="handleOverlayClick">
      <div class="article-modal" @click.stop>
        <div
          data-testid="card-reader-session-content"
          class="contents"
          :inert="readerLinkUrl ? true : undefined"
          :aria-hidden="readerLinkUrl ? 'true' : undefined"
        >
          <!-- Reuse ArticleToolbar with modal mode -->
          <ArticleToolbar
            :article="article"
            :show-content="showContent"
            :show-translations="showTranslations"
            :is-modal="true"
            @close="emit('close')"
            @toggle-content-view="toggleContentView"
            @toggle-read="toggleRead"
            @toggle-favorite="emit('toggleFavorite')"
            @toggle-read-later="emit('toggleReadLater')"
            @open-original="openOriginal"
            @toggle-translations="toggleTranslations"
            @reload-content="handleReloadContent"
            @export-to-obsidian="exportToObsidian"
            @export-to-notion="exportToNotion"
            @export-to-zotero="exportToZotero"
          />

          <!-- Modal content -->
          <div class="modal-content">
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
              class="modal-prose-content"
              @retry-load-content="handleRetryLoadContent"
              @reading-progress="handleReadingProgress"
              @open-link="openReaderLink"
            />
          </div>

          <!-- Navigation buttons -->
          <div v-if="hasPreviousArticle || hasNextArticle" class="modal-navigation">
            <button
              v-if="hasPreviousArticle"
              class="nav-btn"
              :title="t('article.navigation.previousArticle')"
              @click="emit('previous')"
            >
              <PhCaretLeft :size="16" />
              <span>{{ t('article.navigation.previousArticle') }}</span>
            </button>
            <div v-else class="w-24"></div>

            <button
              v-if="hasNextArticle"
              class="nav-btn"
              :title="t('article.navigation.nextArticle')"
              @click="emit('next')"
            >
              <span>{{ t('article.navigation.nextArticle') }}</span>
              <PhCaretRight :size="16" />
            </button>
            <div v-else class="w-24"></div>
          </div>
        </div>

        <section
          v-if="readerLinkUrl"
          data-testid="card-link-preview"
          class="absolute inset-0 z-10 flex flex-col bg-bg-primary"
          role="dialog"
          aria-modal="true"
          :aria-label="t('article.readingMode.linkPreview')"
        >
          <header class="flex shrink-0 items-center border-b border-border bg-bg-primary px-3 py-2">
            <button
              ref="returnToReadingButton"
              type="button"
              data-testid="card-return-to-reading"
              class="inline-flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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

      <!-- Find in Page -->
      <FindInPage
        v-if="showFindInPage && showContent"
        container-selector=".modal-prose-content"
        :article-id="article?.id"
        @close="showFindInPage = false"
      />

      <!-- Image Viewer -->
      <ImageViewer
        v-if="imageViewerSrc"
        :src="imageViewerSrc"
        :alt="imageViewerAlt"
        :images="imageViewerImages"
        :initial-index="imageViewerInitialIndex"
        @close="closeImageViewer"
      />
    </div>
  </Teleport>
</template>

<style scoped>
@reference "../../style.css";
.article-modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4;
  background-color: var(--overlay-backdrop);
}

.article-modal {
  @apply relative bg-bg-primary w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden;
}

.modal-content {
  @apply flex-1 overflow-hidden flex flex-col;
}

.modal-navigation {
  @apply flex items-center justify-between px-3 py-2 border-t border-border bg-bg-primary;
}

.nav-btn {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors;
}

/* Override ArticleContent styling inside modal */
:deep(.modal-prose-content) {
  @apply flex-1 overflow-auto;
}
</style>
