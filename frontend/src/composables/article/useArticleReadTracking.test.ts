import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article, Feed } from '@/types/models';
import en from '@/i18n/locales/en';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
import { useAppStore } from '@/stores/app';
import { useArticleReadTracking } from './useArticleReadTracking';

const defaultFetch = vi.mocked(global.fetch).getMockImplementation();

const article: Article = {
  id: 1,
  feed_id: 1,
  title: 'Article',
  url: 'https://example.com/article',
  published_at: '2026-08-22T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

const feed: Feed = {
  id: 1,
  title: 'Feed',
  url: 'https://example.com/feed.xml',
  category: '',
  last_fetched_at: '',
};

function response(ok = true): Response {
  return { ok, status: ok ? 200 : 500 } as Response;
}

let wrapper: VueWrapper | undefined;

function mountReadTracking(options: { markReadOnScroll?: boolean; feed?: Feed } = {}) {
  setSettingsFromRawData({
    mark_read_on_scroll: options.markReadOnScroll ? 'true' : 'false',
  });

  const pinia = createPinia();
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  let store: ReturnType<typeof useAppStore> | undefined;
  let tracking: ReturnType<typeof useArticleReadTracking> | undefined;

  wrapper = mount(
    defineComponent({
      setup() {
        store = useAppStore();
        tracking = useArticleReadTracking();
        return () => h('div');
      },
    }),
    { global: { plugins: [pinia, i18n] } }
  );

  store!.feeds = [options.feed ?? feed];
  vi.spyOn(store!, 'fetchUnreadCounts').mockResolvedValue();
  vi.spyOn(store!, 'fetchFilterCounts').mockResolvedValue();

  return { store: store!, tracking: tracking! };
}

describe('useArticleReadTracking', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    setSettingsFromRawData({});
    if (defaultFetch) {
      vi.mocked(global.fetch).mockImplementation(defaultFetch);
    }
  });

  it('defers RSS read state until 50% progress when scroll marking is enabled', async () => {
    vi.mocked(global.fetch).mockResolvedValue(response());
    const { tracking } = mountReadTracking({ markReadOnScroll: true });
    const unreadArticle = { ...article };

    await tracking.handleArticleOpened(unreadArticle, 'rss');
    await tracking.handleReadingProgress(unreadArticle, 49);

    expect(unreadArticle.is_read).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();

    await tracking.handleReadingProgress(unreadArticle, 50);
    await tracking.handleReadingProgress(unreadArticle, 100);

    expect(unreadArticle.is_read).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/articles/read?id=1&read=true', {
      method: 'POST',
    });
  });

  it('keeps immediate marking for RSS when scroll marking is disabled', async () => {
    vi.mocked(global.fetch).mockResolvedValue(response());
    const { tracking } = mountReadTracking();
    const unreadArticle = { ...article };

    await tracking.handleArticleOpened(unreadArticle, 'rss');

    expect(unreadArticle.is_read).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('marks webpage and external surfaces immediately even when scroll marking is enabled', async () => {
    vi.mocked(global.fetch).mockResolvedValue(response());
    const { tracking } = mountReadTracking({ markReadOnScroll: true });

    await tracking.handleArticleOpened({ ...article, id: 2 }, 'webpage');
    await tracking.handleArticleOpened({ ...article, id: 3 }, 'external');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('only enables automatic reading mode for non-external feeds', () => {
    const { tracking } = mountReadTracking({
      feed: { ...feed, auto_reading_mode: true, article_view_mode: 'rendered' },
    });

    expect(tracking.shouldAutoEnterReadingMode(article)).toBe(true);
    expect(tracking.shouldAutoEnterReadingMode({ ...article, feed_id: 2 })).toBe(false);

    const { tracking: externalTracking } = mountReadTracking({
      feed: { ...feed, auto_reading_mode: true, article_view_mode: 'external' },
    });

    expect(externalTracking.shouldAutoEnterReadingMode(article)).toBe(false);
  });

  it('rolls back a failed update so a later scroll can retry it', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response());
    const { tracking } = mountReadTracking({ markReadOnScroll: true });
    const unreadArticle = { ...article };

    await expect(tracking.handleReadingProgress(unreadArticle, 50)).rejects.toThrow(
      'Unable to update article read state'
    );
    expect(unreadArticle.is_read).toBe(false);

    await tracking.handleReadingProgress(unreadArticle, 50);

    expect(unreadArticle.is_read).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('serializes opposing updates for the same article', async () => {
    let resolveFirstRequest: ((value: Response) => void) | undefined;
    vi.mocked(global.fetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirstRequest = resolve;
          })
      )
      .mockResolvedValueOnce(response());
    const { tracking } = mountReadTracking();
    const readArticle = { ...article };

    const markRead = tracking.setReadState(readArticle, true);
    const markUnread = tracking.setReadState(readArticle, false);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    resolveFirstRequest?.(response());
    await Promise.all([markRead, markUnread]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(readArticle.is_read).toBe(false);
  });
});
