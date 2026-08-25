/* eslint-disable vue/one-component-per-file */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
import ArticleDetailModal from './ArticleDetailModal.vue';

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

let wrapper: VueWrapper | undefined;

const ArticleContentStub = defineComponent({
  emits: ['readingProgress', 'scrollability', 'shortArticleDwell'],
  setup(_, { emit }) {
    return () => h('button', { onClick: () => emit('readingProgress', 50) }, 'Content');
  },
});

function readRequests() {
  return vi
    .mocked(global.fetch)
    .mock.calls.filter(([url]) => String(url).startsWith('/api/articles/read'));
}

describe('ArticleDetailModal original webpage view', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
    setSettingsFromRawData({});
  });

  it('names the original webpage frame from the article title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ default_view_mode: 'original' }),
      })
    );
    wrapper = mount(ArticleDetailModal, {
      props: {
        article: { ...article },
        articleContent: '',
        isLoadingContent: false,
      },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          Teleport: true,
          ArticleToolbar: true,
          ArticleContent: true,
          FindInPage: true,
          ImageViewer: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('iframe').attributes('title')).toBe(article.title);
  });

  it('defers rendered RSS marking until reading progress reaches 50%', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          default_view_mode: 'rendered',
          mark_read_on_scroll: 'true',
        }),
      })
    );
    setSettingsFromRawData({ default_view_mode: 'rendered', mark_read_on_scroll: 'true' });
    wrapper = mount(ArticleDetailModal, {
      props: {
        article: { ...article },
        articleContent: '<p>Body</p>',
        isLoadingContent: false,
      },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          Teleport: true,
          ArticleToolbar: true,
          ArticleContent: ArticleContentStub,
          FindInPage: true,
          ImageViewer: true,
        },
      },
    });

    await flushPromises();
    wrapper.findComponent(ArticleContentStub).vm.$emit('readingProgress', 49);
    await flushPromises();

    expect(readRequests()).toHaveLength(0);

    wrapper.findComponent(ArticleContentStub).vm.$emit('readingProgress', 50);
    await flushPromises();

    expect(readRequests()).toHaveLength(1);
  });

  it('uses the existing scroll-read policy when a short reader dwell completes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          default_view_mode: 'rendered',
          mark_read_on_scroll: 'true',
        }),
      })
    );
    setSettingsFromRawData({ default_view_mode: 'rendered', mark_read_on_scroll: 'true' });
    wrapper = mount(ArticleDetailModal, {
      props: {
        article: { ...article, is_read: false },
        articleContent: '<p>Short article</p>',
        isLoadingContent: false,
      },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          Teleport: true,
          ArticleToolbar: true,
          ArticleContent: ArticleContentStub,
          FindInPage: true,
          ImageViewer: true,
        },
      },
    });

    await flushPromises();
    expect(readRequests()).toHaveLength(0);

    wrapper.findComponent(ArticleContentStub).vm.$emit('shortArticleDwell');
    await flushPromises();

    expect(readRequests()).toHaveLength(1);
  });

  it('marks webpage presentation immediately even when scroll marking is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          default_view_mode: 'original',
          mark_read_on_scroll: 'true',
        }),
      })
    );
    setSettingsFromRawData({ default_view_mode: 'original', mark_read_on_scroll: 'true' });
    wrapper = mount(ArticleDetailModal, {
      props: {
        article: { ...article },
        articleContent: '<p>Body</p>',
        isLoadingContent: false,
      },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          Teleport: true,
          ArticleToolbar: true,
          ArticleContent: true,
          FindInPage: true,
          ImageViewer: true,
        },
      },
    });

    await flushPromises();

    expect(readRequests()).toHaveLength(1);
  });

  it('keeps find, contents, and translation display state within the card reader session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ default_view_mode: 'rendered' }),
      })
    );
    setSettingsFromRawData({ default_view_mode: 'rendered' });
    const ToolbarStub = defineComponent({
      name: 'ArticleToolbar',
      props: {
        isReadingMode: Boolean,
        hasReaderContent: Boolean,
        showTranslations: Boolean,
        translationDisplayMode: { type: String, default: undefined },
      },
      emits: ['openFind', 'toggleContents', 'setTranslationDisplayMode', 'toggleContentView'],
      setup(_, { emit }) {
        return () =>
          h('div', [
            h('button', {
              'data-testid': 'card-open-find',
              onClick: () => emit('openFind'),
            }),
            h('button', {
              'data-testid': 'card-toggle-contents',
              onClick: () => emit('toggleContents'),
            }),
            h('button', {
              'data-testid': 'card-show-original',
              onClick: () => emit('setTranslationDisplayMode', 'original'),
            }),
            h('button', {
              'data-testid': 'card-toggle-content',
              onClick: () => emit('toggleContentView'),
            }),
          ]);
      },
    });
    const ContentStub = defineComponent({
      name: 'ArticleContent',
      props: {
        showContents: Boolean,
        showTranslations: Boolean,
        translationDisplayMode: { type: String, default: undefined },
        isReadingMode: Boolean,
      },
      emits: ['closeContents'],
      setup(props) {
        return () =>
          h('div', {
            'data-testid': 'card-reader-content',
            'data-show-contents': String(props.showContents),
            'data-is-reading-mode': String(props.isReadingMode),
            'data-translation-display-mode': props.translationDisplayMode,
          });
      },
    });
    wrapper = mount(ArticleDetailModal, {
      props: {
        article: { ...article },
        articleContent: '<h2>Section</h2><p>Body</p>',
        isLoadingContent: false,
      },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          Teleport: true,
          ArticleToolbar: ToolbarStub,
          ArticleContent: ContentStub,
          FindInPage: { name: 'FindInPage', template: '<div data-testid="card-find-in-page" />' },
          ImageViewer: true,
        },
      },
    });

    await flushPromises();

    const toolbar = wrapper.getComponent(ToolbarStub);
    const content = wrapper.getComponent(ContentStub);
    expect(toolbar.props('isReadingMode')).toBe(true);
    expect(toolbar.props('hasReaderContent')).toBe(true);
    expect(content.props('isReadingMode')).toBe(true);
    await wrapper.get('[data-testid="card-open-find"]').trigger('click');
    await wrapper.get('[data-testid="card-toggle-contents"]').trigger('click');
    await wrapper.get('[data-testid="card-show-original"]').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-testid="card-find-in-page"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-testid="card-reader-content"]').attributes('data-show-contents')
    ).toBe('true');
    expect(
      wrapper.get('[data-testid="card-reader-content"]').attributes('data-translation-display-mode')
    ).toBe('original');
    expect(wrapper.getComponent(ContentStub).props('showTranslations')).toBe(true);

    await wrapper.get('[data-testid="card-toggle-content"]').trigger('click');
    expect(wrapper.find('iframe').exists()).toBe(true);
    expect(wrapper.findComponent(ContentStub).exists()).toBe(false);

    await wrapper.get('[data-testid="card-toggle-content"]').trigger('click');
    const reopenedContent = wrapper.getComponent(ContentStub);
    expect(reopenedContent.props('isReadingMode')).toBe(true);
    expect(reopenedContent.props('translationDisplayMode')).toBeUndefined();
    expect(reopenedContent.props('showTranslations')).toBe(true);
  });

  it('shows a linked page inside the card modal instead of handing it to the browser', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ default_view_mode: 'rendered' }),
      })
    );
    setSettingsFromRawData({ default_view_mode: 'rendered' });
    const LinkArticleContentStub = defineComponent({
      name: 'ArticleContent',
      emits: ['openLink'],
      setup(_, { emit }) {
        return () =>
          h(
            'button',
            {
              'data-testid': 'emit-card-link',
              onClick: () => emit('openLink', 'https://example.com/related'),
            },
            'Open linked page'
          );
      },
    });

    wrapper = mount(ArticleDetailModal, {
      attachTo: document.body,
      props: {
        article: { ...article },
        articleContent: '<p>Body</p>',
        isLoadingContent: false,
      },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          Teleport: true,
          ArticleToolbar: true,
          ArticleContent: LinkArticleContentStub,
          FindInPage: true,
          ImageViewer: true,
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-testid="emit-card-link"]').trigger('click');

    const preview = wrapper.get('[data-testid="card-link-preview"]');
    expect(preview.get('iframe').attributes('src')).toContain(
      encodeURIComponent('https://example.com/related')
    );
    expect(wrapper.get('[data-testid="card-reader-session-content"]').attributes()).toHaveProperty(
      'inert'
    );

    await wrapper.get('[data-testid="card-return-to-reading"]').trigger('click');

    expect(wrapper.find('[data-testid="card-link-preview"]').exists()).toBe(false);
    expect(wrapper.findComponent(LinkArticleContentStub).exists()).toBe(true);

    await wrapper.get('[data-testid="emit-card-link"]').trigger('click');
    const previewFrame = wrapper.get('[data-testid="card-link-preview"] iframe')
      .element as HTMLIFrameElement;
    const previewDocument = previewFrame.contentDocument;
    previewDocument?.open();
    previewDocument?.write(
      '<!doctype html><html><body><button>Frame control</button></body></html>'
    );
    previewDocument?.close();
    previewFrame.dispatchEvent(new Event('load'));
    previewDocument?.addEventListener('keydown', (event) => event.stopPropagation());
    previewDocument?.body?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    await flushPromises();

    expect(wrapper.find('[data-testid="card-link-preview"]').exists()).toBe(false);
    expect(wrapper.emitted('close')).toBeUndefined();
  });
});
