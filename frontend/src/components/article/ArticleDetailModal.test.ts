import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
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
  emits: ['readingProgress'],
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
