import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article, Feed } from '@/types/models';
import en from '@/i18n/locales/en';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
import { useAppStore } from '@/stores/app';
import { useArticleDetail } from './useArticleDetail';

const defaultFetch = vi.mocked(global.fetch).getMockImplementation();

const firstArticle: Article = {
  id: 1,
  feed_id: 1,
  title: 'First article',
  url: 'https://example.com/first',
  published_at: '2026-08-22T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

const secondArticle: Article = {
  ...firstArticle,
  id: 2,
  title: 'Second article',
  url: 'https://example.com/second',
};

function response(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

let wrapper: VueWrapper | undefined;

interface DetailMountOptions {
  feeds?: Feed[];
  loadContent?: (articleId: number) => Promise<string>;
}

function makeFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 1,
    title: 'Feed',
    url: 'https://example.com/feed.xml',
    category: '',
    last_fetched_at: '',
    ...overrides,
  };
}

async function mountDetailWithContent(
  contents: Record<number, string>,
  options: DetailMountOptions = {}
) {
  const pinia = createPinia();
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  let store: ReturnType<typeof useAppStore> | undefined;
  let detail: ReturnType<typeof useArticleDetail> | undefined;

  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);

    if (url.startsWith('/api/articles/content?id=')) {
      const articleId = Number(url.split('=').at(-1));
      const content = options.loadContent
        ? await options.loadContent(articleId)
        : (contents[articleId] ?? '');
      return response({ content, cached: true });
    }

    if (url === '/api/settings') {
      return response({ default_view_mode: 'original', media_cache_enabled: false });
    }

    return response({});
  });

  wrapper = mount(
    defineComponent({
      setup() {
        store = useAppStore();
        detail = useArticleDetail();
        return () => h('div');
      },
    }),
    { global: { plugins: [pinia, i18n] } }
  );

  store!.articles = [firstArticle, secondArticle];
  store!.feeds = options.feeds ?? [];
  store!.currentArticleId = firstArticle.id;
  await nextTick();
  await flushPromises();

  return {
    detail: detail!,
    store: store!,
  };
}

describe('useArticleDetail reading mode', () => {
  beforeEach(() => {
    localStorage.removeItem('articleViewModePreferences');
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    if (defaultFetch) {
      vi.mocked(global.fetch).mockImplementation(defaultFetch);
    }
    setSettingsFromRawData({});
  });

  it('enters automatic reading mode only after RSS content is ready', async () => {
    const { detail, store } = await mountDetailWithContent(
      { 1: '<p>First body</p>' },
      {
        feeds: [makeFeed({ auto_reading_mode: true, article_view_mode: 'webpage' })],
      }
    );

    expect(detail.showContent.value).toBe(true);
    expect(store.isReadingMode).toBe(true);
  });

  it('does not enter automatic reading mode for empty or external content', async () => {
    const empty = await mountDetailWithContent(
      { 1: '' },
      {
        feeds: [makeFeed({ auto_reading_mode: true, article_view_mode: 'webpage' })],
      }
    );

    expect(empty.detail.showContent.value).toBe(false);
    expect(empty.store.isReadingMode).toBe(false);
    wrapper?.unmount();

    const external = await mountDetailWithContent(
      { 1: '<p>First body</p>' },
      {
        feeds: [makeFeed({ auto_reading_mode: true, article_view_mode: 'external' })],
      }
    );

    expect(external.store.isReadingMode).toBe(false);
  });

  it('ignores stale automatic-reader content after the selection changes', async () => {
    let resolveFirstContent: ((content: string) => void) | undefined;
    const secondFeedArticle = { ...secondArticle, feed_id: 2 };
    const { detail, store } = await mountDetailWithContent(
      { 2: '<p>Second body</p>' },
      {
        feeds: [
          makeFeed({ id: 1, auto_reading_mode: true, article_view_mode: 'webpage' }),
          makeFeed({ id: 2, auto_reading_mode: false, article_view_mode: 'webpage' }),
        ],
        loadContent: (articleId) => {
          if (articleId === 1) {
            return new Promise((resolve) => {
              resolveFirstContent = resolve;
            });
          }

          return Promise.resolve('<p>Second body</p>');
        },
      }
    );

    store.articles = [firstArticle, secondFeedArticle];
    store.currentArticleId = secondFeedArticle.id;
    await nextTick();
    await flushPromises();
    resolveFirstContent?.('<p>First body</p>');
    await flushPromises();

    expect(store.currentArticleId).toBe(secondFeedArticle.id);
    expect(detail.showContent.value).toBe(false);
    expect(store.isReadingMode).toBe(false);
  });

  it('re-enters automatic reading mode for the next configured article after a manual exit', async () => {
    const { detail, store } = await mountDetailWithContent(
      { 1: '<p>First body</p>', 2: '<p>Second body</p>' },
      {
        feeds: [makeFeed({ auto_reading_mode: true, article_view_mode: 'webpage' })],
      }
    );

    await detail.toggleReadingMode();
    expect(store.isReadingMode).toBe(false);

    store.currentArticleId = secondArticle.id;
    await nextTick();
    await flushPromises();

    expect(detail.showContent.value).toBe(true);
    expect(store.isReadingMode).toBe(true);
  });

  it('enters reading mode from loaded RSS content', async () => {
    const { detail, store } = await mountDetailWithContent({ 1: '<p>First body</p>' });

    await detail.toggleReadingMode();

    expect(store.isReadingMode).toBe(true);
    expect(detail.showContent.value).toBe(true);
  });

  it('does not enter reading mode when RSS content is empty', async () => {
    const { detail, store } = await mountDetailWithContent({ 1: '' });

    await detail.toggleReadingMode();

    expect(store.isReadingMode).toBe(false);
    expect(detail.showContent.value).toBe(false);
  });

  it('keeps reading mode when moving to the next article', async () => {
    const { detail, store } = await mountDetailWithContent({
      1: '<p>First body</p>',
      2: '<p>Second body</p>',
    });

    await detail.toggleReadingMode();
    store.currentArticleId = secondArticle.id;
    await nextTick();
    await flushPromises();

    expect(store.isReadingMode).toBe(true);
    expect(detail.showContent.value).toBe(true);
  });

  it('exits reading mode when switching to the original webpage', async () => {
    const { detail, store } = await mountDetailWithContent({ 1: '<p>First body</p>' });

    await detail.toggleReadingMode();
    await detail.toggleContentView();

    expect(detail.showContent.value).toBe(false);
    expect(store.isReadingMode).toBe(false);
  });

  it('exits reading mode when the article closes', async () => {
    const { detail, store } = await mountDetailWithContent({ 1: '<p>First body</p>' });

    store.setReadingMode(true);
    detail.close();

    expect(store.currentArticleId).toBeNull();
    expect(store.isReadingMode).toBe(false);
  });
});
