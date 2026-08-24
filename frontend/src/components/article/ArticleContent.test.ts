import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount, shallowMount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article } from '@/types/models';
import type { ThemePreset } from '@/utils/theme';
import en from '@/i18n/locales/en';
import ArticleContent from './ArticleContent.vue';
import ArticleContinuation from './parts/ArticleContinuation.vue';
import ArticleTitle from './parts/ArticleTitle.vue';
import { useAppStore } from '@/stores/app';
import { setSettingsFromRawData } from '@/composables/core/useSettings';

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
const defaultFetch = vi.mocked(global.fetch).getMockImplementation();

function response(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

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

function mountReaderWithBodyLink(articleContent: string) {
  const pinia = createPinia();
  wrapper = mount(ArticleContent, {
    attachTo: document.body,
    props: {
      article,
      articleContent,
      isLoadingContent: false,
      isReadingMode: true,
    },
    global: {
      plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        ArticleTitle: true,
        ArticleSummary: true,
        FloatingToc: true,
        AudioPlayer: true,
        VideoPlayer: true,
        ArticleChatButton: true,
        ArticleChatPanel: true,
      },
    },
  });

  return wrapper;
}

function mountReaderWithDelayedSummaryLink() {
  let resolveSummaryRequest: ((value: Response) => void) | undefined;

  vi.mocked(global.fetch).mockImplementation((input) => {
    const url = String(input);

    if (url === '/api/settings') {
      return Promise.resolve(
        response({
          summary_enabled: 'true',
          summary_provider: 'ai',
          summary_trigger_mode: 'manual',
          translation_enabled: 'false',
        })
      );
    }

    if (url === '/api/articles/summarize') {
      return new Promise<Response>((resolve) => {
        resolveSummaryRequest = resolve;
      });
    }

    return Promise.resolve(response({}));
  });

  const pinia = createPinia();
  wrapper = mount(ArticleContent, {
    attachTo: document.body,
    props: {
      article,
      articleContent: '<p>Body</p>',
      isLoadingContent: false,
      isReadingMode: true,
    },
    global: {
      plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        ArticleTitle: true,
        ArticleSummary: {
          props: ['summaryResult'],
          emits: ['generate-summary'],
          template: `
            <div class="summary-display">
              <button data-testid="generate-summary" @click="$emit('generate-summary')">
                Generate summary
              </button>
              <a v-if="summaryResult" href="/summary-reference" target="_blank">Summary reference</a>
            </div>
          `,
        },
        FloatingToc: true,
        AudioPlayer: true,
        VideoPlayer: true,
        ArticleChatButton: true,
        ArticleChatPanel: true,
      },
    },
  });

  return {
    reader: wrapper,
    resolveSummaryRequest: (data: unknown) => {
      if (!resolveSummaryRequest) {
        throw new Error('The summary request did not start');
      }
      resolveSummaryRequest(response(data));
    },
  };
}

describe('ArticleContent reading mode', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    if (defaultFetch) {
      vi.mocked(global.fetch).mockImplementation(defaultFetch);
    }
    setSettingsFromRawData({});
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

  it('requests an in-app reader link view instead of allowing native navigation', async () => {
    const mountedReader = mountReaderWithBodyLink(`
      <p><a href="/related" target="_blank">Root-relative</a></p>
      <p><a href="next-page">Path-relative</a></p>
    `);
    await flushPromises();
    await nextTick();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockClear();

    const [rootRelativeLink, pathRelativeLink] = mountedReader.findAll('.prose-content a');
    expect(rootRelativeLink.attributes('href')).toBe('https://example.com/related');
    expect(pathRelativeLink.attributes('href')).toBe('https://example.com/next-page');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    rootRelativeLink.element.dispatchEvent(event);
    await nextTick();

    expect(event.defaultPrevented).toBe(true);
    expect(mountedReader.emitted('openLink')).toEqual([['https://example.com/related']]);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/browser/open')).toBe(
      false
    );
  });

  it('does not request an in-app reader link view for a page fragment or image link', async () => {
    const mountedReader = mountReaderWithBodyLink(`
      <p><a href="#section">Section</a></p>
      <a href="/photo"><img src="https://example.com/photo.png" alt="Photo"></a>
    `);
    await flushPromises();
    await nextTick();

    const [fragmentLink, imageLink] = mountedReader.findAll('.prose-content a');
    const fragmentEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    const imageEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    let fragmentWasPrevented = true;
    let imageWasPrevented = true;
    fragmentLink.element.addEventListener('click', (event) => {
      fragmentWasPrevented = event.defaultPrevented;
      event.preventDefault();
    });
    imageLink.element.addEventListener('click', (event) => {
      imageWasPrevented = event.defaultPrevented;
      event.preventDefault();
    });
    fragmentLink.element.dispatchEvent(fragmentEvent);
    imageLink.element.dispatchEvent(imageEvent);
    await nextTick();

    expect(fragmentWasPrevented).toBe(false);
    expect(imageWasPrevented).toBe(false);
    expect(mountedReader.emitted('openLink')).toBeUndefined();
  });

  it('normalizes and opens links that render after a manually generated summary', async () => {
    const { reader, resolveSummaryRequest } = mountReaderWithDelayedSummaryLink();
    await flushPromises();
    await nextTick();
    await reader.get('[data-testid="generate-summary"]').trigger('click');
    await flushPromises();

    resolveSummaryRequest({
      summary: 'Read the reference',
      html: '<p>Read the reference</p>',
      sentence_count: 1,
      is_too_short: false,
    });
    await flushPromises();
    await nextTick();

    const link = reader.get('.summary-display a');
    expect(link.attributes('href')).toBe('https://example.com/summary-reference');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.element.dispatchEvent(event);
    await nextTick();

    expect(event.defaultPrevented).toBe(true);
    expect(reader.emitted('openLink')).toEqual([['https://example.com/summary-reference']]);
  });

  it('passes Magazine to the reading column and title only while reading', async () => {
    setSettingsFromRawData({
      content_font_family: 'serif',
      content_font_size: '17',
      content_line_height: '1.7',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
    });
    const mountedReader = mountReader('<p>Body</p>', { isReadingMode: true });

    expect(
      mountedReader.get('[data-testid="article-reading-column"]').attributes('data-reader-style')
    ).toBe('magazine');
    expect(mountedReader.findComponent(ArticleTitle).props('readerStyle')).toBe('magazine');

    await mountedReader.setProps({ isReadingMode: false });
    expect(mountedReader.findComponent(ArticleTitle).props('readerStyle')).toBe('custom');
  });
});
