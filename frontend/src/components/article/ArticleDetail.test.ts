import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import ArticleDetail from './ArticleDetail.vue';

vi.mock('@/utils/mediaProxy', () => ({
  isMediaCacheEnabled: vi.fn().mockResolvedValue(false),
  proxyImagesInHtml: (content: string) => content,
}));

const article: Article = {
  id: 1,
  feed_id: 1,
  title: 'Original webpage article',
  url: 'https://example.com/article',
  published_at: '2026-08-22T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

const nextArticle: Article = {
  id: 2,
  feed_id: 1,
  feed_title: 'Daily Briefing',
  title: 'Second article',
  url: 'https://example.com/second',
  published_at: '2026-08-22T01:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

let wrapper: VueWrapper | undefined;

describe('ArticleDetail original webpage view', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
  });

  it('names the original webpage frame from the article title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: '', default_view_mode: 'original' }),
      })
    );
    const pinia = createPinia();
    wrapper = mount(ArticleDetail, {
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ImageViewer: true,
          FindInPage: true,
        },
      },
    });
    const store = useAppStore(pinia);
    store.articles = [article];
    store.currentArticleId = article.id;

    await nextTick();
    await flushPromises();

    expect(wrapper.get('iframe').attributes('title')).toBe(article.title);
  });

  it('uses the in-content continuation in reading mode and hides fixed navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: '<p>Body</p>', cached: true }),
      })
    );
    const pinia = createPinia();
    wrapper = mount(ArticleDetail, {
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ArticleToolbar: true,
          ArticleContent: {
            name: 'ArticleContent',
            props: ['nextArticle'],
            emits: ['navigateNext'],
            template: '<button data-testid="continue" @click="$emit(\'navigateNext\')"></button>',
          },
          ImageViewer: true,
          FindInPage: true,
        },
      },
    });
    const store = useAppStore(pinia);
    store.articles = [article, nextArticle];
    store.articleViewModePreferences.set(article.id, 'rendered');
    store.currentArticleId = article.id;

    await nextTick();
    await flushPromises();

    expect(wrapper.findComponent({ name: 'ArticleContent' }).props('nextArticle')).toMatchObject({
      id: nextArticle.id,
    });
    expect(wrapper.get('[data-testid="article-navigation"]').exists()).toBe(true);

    store.setReadingMode(true);
    await nextTick();
    expect(wrapper.find('[data-testid="article-navigation"]').exists()).toBe(false);

    await wrapper.get('[data-testid="continue"]').trigger('click');
    expect(store.currentArticleId).toBe(nextArticle.id);
  });
});
