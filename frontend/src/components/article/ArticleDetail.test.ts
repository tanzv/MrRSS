import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
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
    wrapper?.element.remove();
    wrapper = undefined;
    vi.unstubAllGlobals();
    setSettingsFromRawData({});
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

  it('keeps reader appearance unavailable until RSS body content has rendered', async () => {
    async function mountWithContent(content: string) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ content, cached: true }),
        })
      );
      const pinia = createPinia();
      wrapper = mount(ArticleDetail, {
        global: {
          plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
          stubs: {
            ArticleToolbar: {
              name: 'ArticleToolbar',
              props: ['hasReaderContent'],
              template: '<div />',
            },
            ArticleContent: true,
            ImageViewer: true,
            FindInPage: true,
          },
        },
      });
      const store = useAppStore(pinia);
      store.articles = [article];
      store.articleViewModePreferences.set(article.id, 'rendered');
      store.currentArticleId = article.id;
      await nextTick();
      await flushPromises();

      return wrapper;
    }

    const empty = await mountWithContent('');
    expect(empty.getComponent({ name: 'ArticleToolbar' }).props('hasReaderContent')).toBe(false);
    empty.unmount();
    wrapper = undefined;

    const rendered = await mountWithContent('<p>Body</p>');
    expect(rendered.getComponent({ name: 'ArticleToolbar' }).props('hasReaderContent')).toBe(true);
  });

  it('forwards find, contents, and translation display intent to the rendered reader session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: '<h2>Section</h2><p>Body</p>', cached: true }),
      })
    );
    const pinia = createPinia();
    wrapper = mount(ArticleDetail, {
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ArticleToolbar: {
            name: 'ArticleToolbar',
            props: ['showTranslations', 'translationDisplayMode'],
            emits: ['openFind', 'toggleContents', 'setTranslationDisplayMode'],
            template: '<div />',
          },
          ArticleContent: {
            name: 'ArticleContent',
            props: ['showContents', 'showTranslations', 'translationDisplayMode'],
            emits: ['closeContents'],
            template: '<div />',
          },
          ImageViewer: true,
          FindInPage: { name: 'FindInPage', template: '<div data-testid="find-in-page" />' },
        },
      },
    });
    const store = useAppStore(pinia);
    store.articles = [article];
    store.articleViewModePreferences.set(article.id, 'rendered');
    store.currentArticleId = article.id;

    await nextTick();
    await flushPromises();

    const toolbar = wrapper.getComponent({ name: 'ArticleToolbar' });
    const content = wrapper.getComponent({ name: 'ArticleContent' });
    store.setReadingMode(true);
    await nextTick();
    toolbar.vm.$emit('openFind');
    toolbar.vm.$emit('toggleContents');
    toolbar.vm.$emit('setTranslationDisplayMode', 'original');
    await nextTick();

    expect(wrapper.find('[data-testid="find-in-page"]').exists()).toBe(true);
    expect(content.props('showContents')).toBe(true);
    expect(content.props('translationDisplayMode')).toBe('original');
    expect(content.props('showTranslations')).toBe(true);

    content.vm.$emit('closeContents');
    await nextTick();
    expect(content.props('showContents')).toBe(false);

    store.setReadingMode(false);
    await nextTick();
    expect(content.props('translationDisplayMode')).toBeUndefined();
    expect(content.props('showTranslations')).toBe(true);
  });

  it('keeps short reader articles out of the progress UI and marks them after dwell confirmation', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/settings') {
        return Promise.resolve({
          ok: true,
          json: vi
            .fn()
            .mockResolvedValue({ default_view_mode: 'rendered', mark_read_on_scroll: 'true' }),
        });
      }

      if (url.startsWith('/api/articles/content')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ content: '<p>Short article</p>', cached: true }),
        });
      }

      return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    setSettingsFromRawData({ default_view_mode: 'rendered', mark_read_on_scroll: 'true' });

    const ToolbarStub = {
      name: 'ArticleToolbar',
      props: ['readingProgress'],
      template: '<div data-testid="reader-toolbar-progress" :data-progress="readingProgress" />',
    };
    const ContentStub = {
      name: 'ArticleContent',
      emits: ['scrollability', 'shortArticleDwell'],
      template: '<div />',
    };
    const pinia = createPinia();
    wrapper = mount(ArticleDetail, {
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ArticleToolbar: ToolbarStub,
          ArticleContent: ContentStub,
          ImageViewer: true,
          FindInPage: true,
        },
      },
    });
    const store = useAppStore(pinia);
    const shortArticle = { ...article, is_read: false };
    store.articles = [shortArticle];
    store.articleViewModePreferences.set(shortArticle.id, 'rendered');
    store.currentArticleId = shortArticle.id;

    await flushPromises();
    store.setReadingMode(true);
    await nextTick();
    expect(shortArticle.is_read).toBe(false);

    const content = wrapper.getComponent({ name: 'ArticleContent' });
    content.vm.$emit('scrollability', false);
    await nextTick();
    expect(wrapper.getComponent({ name: 'ArticleToolbar' }).props('readingProgress')).toBeNull();

    content.vm.$emit('shortArticleDwell');
    await flushPromises();

    expect(shortArticle.is_read).toBe(true);

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/articles/read'))
    ).toHaveLength(1);
  });

  it('returns focus to the reading-mode entry after exiting the reader', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: '<p>Body</p>', cached: true }),
      })
    );
    const pinia = createPinia();
    wrapper = mount(ArticleDetail, {
      attachTo: document.body,
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ArticleContent: true,
          ImageViewer: true,
          FindInPage: true,
        },
      },
    });
    const store = useAppStore(pinia);
    store.articles = [article];
    store.articleViewModePreferences.set(article.id, 'rendered');
    store.currentArticleId = article.id;

    await nextTick();
    await flushPromises();
    store.setReadingMode(true);
    await nextTick();

    await wrapper.get('[data-testid="reader-exit"]').trigger('click');
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="toggle-reading-mode"]').element);
  });

  it('does not take over Ctrl+F while an editable field has focus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: '<p>Body</p>', cached: true }),
      })
    );
    const pinia = createPinia();
    wrapper = mount(ArticleDetail, {
      attachTo: document.body,
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ArticleToolbar: true,
          ArticleContent: true,
          ImageViewer: true,
          FindInPage: { name: 'FindInPage', template: '<div data-testid="find-in-page" />' },
        },
      },
    });
    const store = useAppStore(pinia);
    store.articles = [article];
    store.articleViewModePreferences.set(article.id, 'rendered');
    store.currentArticleId = article.id;
    await nextTick();
    await flushPromises();

    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    await nextTick();

    expect(event.defaultPrevented).toBe(false);
    expect(wrapper.find('[data-testid="find-in-page"]').exists()).toBe(false);
    input.remove();
  });

  it('returns from an in-reader link page without leaving the active reader session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: '<p>Body</p>', cached: true }),
      })
    );
    const pinia = createPinia();
    wrapper = mount(ArticleDetail, {
      attachTo: document.body,
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ArticleToolbar: true,
          ArticleContent: {
            name: 'ArticleContent',
            emits: ['openLink'],
            template:
              '<button data-testid="emit-reader-link" @click="$emit(\'openLink\', \'https://example.com/related\')"></button>',
          },
          ImageViewer: true,
          FindInPage: true,
        },
      },
    });
    const store = useAppStore(pinia);
    store.articles = [article];
    store.articleViewModePreferences.set(article.id, 'rendered');
    store.currentArticleId = article.id;

    await nextTick();
    await flushPromises();
    store.setReadingMode(true);
    await nextTick();

    const linkTrigger = wrapper.get('[data-testid="emit-reader-link"]');
    (linkTrigger.element as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(linkTrigger.element);

    await linkTrigger.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-testid="reader-link-preview"] iframe').attributes('src')).toContain(
      encodeURIComponent('https://example.com/related')
    );
    expect(document.activeElement).toBe(wrapper.get('[data-testid="return-to-reading"]').element);
    expect(wrapper.get('[data-testid="reader-session-content"]').attributes()).toHaveProperty(
      'inert'
    );
    expect(store.isReadingMode).toBe(true);
    expect(wrapper.findComponent({ name: 'ArticleContent' }).exists()).toBe(true);

    await wrapper.get('[data-testid="return-to-reading"]').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-testid="reader-link-preview"]').exists()).toBe(false);
    expect(store.currentArticleId).toBe(article.id);
    expect(store.isReadingMode).toBe(true);
    expect(wrapper.findComponent({ name: 'ArticleContent' }).exists()).toBe(true);
    expect(document.activeElement).toBe(linkTrigger.element);

    await linkTrigger.trigger('click');
    const previewFrame = wrapper.get('[data-testid="reader-link-preview"] iframe')
      .element as HTMLIFrameElement;
    const previewDocument = previewFrame.contentDocument;
    previewDocument?.open();
    previewDocument?.write(
      '<!doctype html><html><body><button>Frame control</button></body></html>'
    );
    previewDocument?.close();
    expect(previewDocument?.body).not.toBeNull();
    previewFrame.dispatchEvent(new Event('load'));
    previewDocument?.addEventListener('keydown', (event) => event.stopPropagation());
    previewDocument?.body?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    await nextTick();

    expect(wrapper.find('[data-testid="reader-link-preview"]').exists()).toBe(false);
    expect(store.currentArticleId).toBe(article.id);
    expect(store.isReadingMode).toBe(true);
  });
});
