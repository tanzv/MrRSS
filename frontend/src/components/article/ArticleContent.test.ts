import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article } from '@/types/models';
import type { ThemePreset } from '@/utils/theme';
import en from '@/i18n/locales/en';
import ArticleContent from './ArticleContent.vue';
import ArticleContinuation from './parts/ArticleContinuation.vue';
import { useAppStore } from '@/stores/app';

const article: Article = {
  id: 1,
  feed_id: 1,
  title: 'Example article',
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
  title: 'Next article',
  url: 'https://example.com/next',
  published_at: '2026-08-22T01:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

let wrapper: VueWrapper | undefined;

function mountReader(
  articleContent = '<p>Body</p>',
  options: { isReadingMode?: boolean; nextArticle?: Article; themePreset?: ThemePreset } = {}
) {
  const pinia = createPinia();
  wrapper = shallowMount(ArticleContent, {
    attachTo: document.body,
    props: {
      article,
      articleContent,
      isLoadingContent: false,
      isReadingMode: options.isReadingMode ?? false,
      nextArticle: options.nextArticle,
    },
    global: {
      plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });

  if (options.themePreset) {
    useAppStore(pinia).theme = options.themePreset;
  }

  return wrapper;
}

describe('ArticleContent reading mode', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('focuses the reader without changing its scroll position and reports progress', async () => {
    const mountedReader = mountReader();
    const reader = mountedReader.get('[data-testid="article-reader"]');
    const column = mountedReader.get('[data-testid="article-reading-column"]');
    expect(mountedReader.get('[data-testid="article-reading-column"]').classes()).toContain(
      'article-reading-column'
    );
    expect(column.attributes('data-reader-width')).toBe('comfortable');
    expect(column.attributes('data-paragraph-spacing')).toBe('comfortable');
    expect(column.attributes('style')).toContain('--reader-font-size: 16px');
    Object.defineProperties(reader.element, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 200, writable: true },
    });

    await wrapper!.setProps({ isReadingMode: true });
    await nextTick();
    await nextTick();

    expect(reader.attributes('role')).toBe('region');
    expect(reader.attributes('tabindex')).toBe('-1');
    expect(reader.attributes('aria-label')).toBe('Article reader');
    expect(document.activeElement).toBe(reader.element);
    expect((reader.element as HTMLElement).scrollTop).toBe(200);

    await reader.trigger('scroll');
    expect(wrapper!.emitted('readingProgress')?.at(-1)).toEqual([50]);
  });

  it('reports initial progress for visible RSS content outside reading mode', async () => {
    const mountedReader = mountReader('');
    const reader = mountedReader.get('[data-testid="article-reader"]');
    Object.defineProperties(reader.element, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 100 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });

    await mountedReader.setProps({ articleContent: '<p>Body</p>' });
    await flushPromises();
    await nextTick();
    await nextTick();

    expect(mountedReader.emitted('readingProgress')?.at(-1)).toEqual([100]);
  });

  it('renders and forwards the next-article intent only in reading mode with RSS content', async () => {
    const mountedReader = mountReader('<p>Body</p>', {
      isReadingMode: true,
      nextArticle,
    });

    const continuation = mountedReader.findComponent(ArticleContinuation);
    expect(continuation.exists()).toBe(true);
    expect(continuation.props('nextArticle')).toMatchObject({ id: nextArticle.id });

    continuation.vm.$emit('navigateNext');
    expect(mountedReader.emitted('navigateNext')).toEqual([[]]);

    await mountedReader.setProps({ isReadingMode: false });
    expect(mountedReader.findComponent(ArticleContinuation).exists()).toBe(false);
  });

  it('labels the reading column with the resolved application theme', async () => {
    const mountedReader = mountReader('<p>Body</p>', { themePreset: 'sepia' });
    await nextTick();

    expect(
      mountedReader.get('[data-testid="article-reading-column"]').attributes('data-reader-theme')
    ).toBe('sepia');
  });
});
