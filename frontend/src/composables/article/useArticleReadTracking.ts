import type { Article, Feed } from '@/types/models';
import { useSettings } from '@/composables/core/useSettings';
import { useAppStore } from '@/stores/app';

export type ArticleViewMode = 'original' | 'rendered' | 'external';
export type ArticleSurface = 'rss' | 'webpage' | 'external';

export const READ_PROGRESS_THRESHOLD = 50;

interface PendingReadUpdate {
  desiredState: boolean;
  promise: Promise<void>;
}

function toArticleViewMode(mode: string | undefined): ArticleViewMode {
  if (mode === 'rendered' || mode === 'external') {
    return mode;
  }

  return 'original';
}

export function useArticleReadTracking() {
  const store = useAppStore();
  const { settings } = useSettings();
  const pendingReadUpdates = new Map<number, PendingReadUpdate>();

  function getFeed(article: Article): Feed | undefined {
    return store.feeds.find((feed) => feed.id === article.feed_id);
  }

  function getEffectiveViewMode(
    article: Article,
    defaultViewMode?: ArticleViewMode
  ): ArticleViewMode {
    const feed = getFeed(article);

    if (feed?.article_view_mode === 'webpage') {
      return 'original';
    }

    if (feed?.article_view_mode === 'rendered' || feed?.article_view_mode === 'external') {
      return feed.article_view_mode;
    }

    return defaultViewMode ?? toArticleViewMode(settings.value.default_view_mode);
  }

  function getArticleSurface(article: Article, defaultViewMode?: ArticleViewMode): ArticleSurface {
    const viewMode = getEffectiveViewMode(article, defaultViewMode);

    if (viewMode === 'external') {
      return 'external';
    }

    return viewMode === 'rendered' ? 'rss' : 'webpage';
  }

  function shouldAutoEnterReadingMode(
    article: Article,
    defaultViewMode?: ArticleViewMode
  ): boolean {
    return (
      getFeed(article)?.auto_reading_mode === true &&
      getEffectiveViewMode(article, defaultViewMode) !== 'external'
    );
  }

  async function setReadState(article: Article, isRead: boolean): Promise<void> {
    const pendingUpdate = pendingReadUpdates.get(article.id);

    if (pendingUpdate) {
      if (pendingUpdate.desiredState === isRead) {
        return pendingUpdate.promise;
      }

      await pendingUpdate.promise.catch(() => undefined);
      return setReadState(article, isRead);
    }

    if (article.is_read === isRead) {
      return;
    }

    const previousState = article.is_read;
    article.is_read = isRead;

    const updatePromise = (async () => {
      try {
        const response = await fetch(`/api/articles/read?id=${article.id}&read=${isRead}`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Unable to update article read state');
        }

        await Promise.all([store.fetchUnreadCounts(), store.fetchFilterCounts()]);
      } catch (error) {
        if (article.is_read === isRead) {
          article.is_read = previousState;
        }
        throw error;
      }
    })();

    pendingReadUpdates.set(article.id, {
      desiredState: isRead,
      promise: updatePromise,
    });

    void updatePromise.then(
      () => {
        if (pendingReadUpdates.get(article.id)?.promise === updatePromise) {
          pendingReadUpdates.delete(article.id);
        }
      },
      () => {
        if (pendingReadUpdates.get(article.id)?.promise === updatePromise) {
          pendingReadUpdates.delete(article.id);
        }
      }
    );

    return updatePromise;
  }

  async function handleArticleOpened(article: Article, surface: ArticleSurface): Promise<void> {
    if (article.is_read) {
      return;
    }

    if (surface === 'rss' && settings.value.mark_read_on_scroll) {
      return;
    }

    await setReadState(article, true);
  }

  async function handleReadingProgress(article: Article, percent: number): Promise<void> {
    if (
      !settings.value.mark_read_on_scroll ||
      article.is_read ||
      percent < READ_PROGRESS_THRESHOLD
    ) {
      return;
    }

    await setReadState(article, true);
  }

  return {
    getEffectiveViewMode,
    getArticleSurface,
    shouldAutoEnterReadingMode,
    setReadState,
    handleArticleOpened,
    handleReadingProgress,
  };
}
