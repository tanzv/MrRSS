import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
import type { Article, Feed } from '@/types/models';
import en from '@/i18n/locales/en';
import ArticleList from './ArticleList.vue';
import ArticleDetailModal from './ArticleDetailModal.vue';

let wrapper: VueWrapper | undefined;
const articleListSource = readFileSync(
  resolve(process.cwd(), 'src/components/article/ArticleList.vue'),
  'utf8'
);

const ArticleCardItemStub = defineComponent({
  props: {
    article: { type: Object as () => Article, required: true },
  },
  emits: ['click'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          'data-article-id': props.article.id,
          onClick: () => emit('click'),
        },
        props.article.title
      );
  },
});

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 1,
    feed_id: 1,
    title: 'Article',
    url: 'https://example.com/article',
    published_at: '2026-08-22T00:00:00Z',
    is_read: false,
    is_favorite: false,
    is_hidden: false,
    is_read_later: false,
    ...overrides,
  };
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

function mountArticleList() {
  const pinia = createPinia();

  wrapper = mount(ArticleList, {
    props: { isSidebarOpen: false },
    global: {
      plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        ArticleItem: true,
        ArticleCardItem: ArticleCardItemStub,
        ArticleDetailModal: true,
        ArticleFilterModal: true,
        AISearchBar: true,
      },
    },
  });

  return { wrapper, store: useAppStore(pinia) };
}

describe('ArticleList interaction feedback', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
    setSettingsFromRawData({});
  });

  it('exposes icon control names and toggle states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
    );
    const { wrapper: mountedList, store } = mountArticleList();
    store.showOnlyUnread = true;
    await nextTick();

    const unreadToggle = mountedList.get('[data-testid="toggle-unread"]');
    const filterToggle = mountedList.get('[data-testid="open-filter"]');

    expect(mountedList.get('[data-testid="mark-all-read"]').attributes('aria-label')).toBe(
      'Mark All as Read'
    );
    expect(unreadToggle.attributes('aria-label')).toBe('Show only unread articles');
    expect(unreadToggle.attributes('aria-pressed')).toBe('true');
    expect(filterToggle.attributes('aria-label')).toBe('Filter');
    expect(filterToggle.attributes('aria-haspopup')).toBe('dialog');
    expect(filterToggle.attributes('aria-expanded')).toBe('false');
    expect(mountedList.get('[data-testid="refresh-articles"]').attributes('aria-label')).toBe(
      'Refresh'
    );
  });

  it('uses the shared panel header and icon action primitives', () => {
    const { wrapper: mountedList } = mountArticleList();

    expect(mountedList.get('.app-panel-header').exists()).toBe(true);
    expect(mountedList.get('[data-testid="mark-all-read"]').classes()).toContain('ui-icon-button');
    expect(mountedList.get('[data-testid="toggle-unread"]').classes()).toContain('ui-icon-button');
  });

  it('uses a named three-row skeleton while articles are loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
    );
    const { wrapper: mountedList, store } = mountArticleList();
    store.isLoading = true;
    await nextTick();

    const status = mountedList.get('[data-testid="article-list-loading"]');

    expect(mountedList.get('.article-list').attributes('aria-busy')).toBe('true');
    expect(status.attributes('role')).toBe('status');
    expect(status.attributes('aria-label')).toBe('Loading');
    expect(status.findAll('[data-testid="article-list-skeleton-row"]')).toHaveLength(3);
  });

  it('uses standard detail rather than a card modal for an automatic-reader feed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ layout_mode: 'card', default_view_mode: 'original' }),
      })
    );
    setSettingsFromRawData({ layout_mode: 'card', default_view_mode: 'original' });
    const { wrapper: mountedList, store } = mountArticleList();
    const article = makeArticle({ id: 7 });
    store.feeds = [makeFeed({ auto_reading_mode: true })];
    store.articles = [article];
    await nextTick();

    await mountedList.get('[data-article-id="7"]').trigger('click');

    expect(store.currentArticleId).toBe(7);
    expect(mountedList.findComponent(ArticleDetailModal).exists()).toBe(false);
  });

  it('keeps the card modal for feeds without automatic reader mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ layout_mode: 'card', default_view_mode: 'original' }),
      })
    );
    setSettingsFromRawData({ layout_mode: 'card', default_view_mode: 'original' });
    const { wrapper: mountedList, store } = mountArticleList();
    const article = makeArticle({ id: 8 });
    store.feeds = [makeFeed({ auto_reading_mode: false })];
    store.articles = [article];
    await nextTick();

    await mountedList.get('[data-article-id="8"]').trigger('click');
    await nextTick();

    expect(store.currentArticleId).toBeNull();
    expect(mountedList.findComponent(ArticleDetailModal).exists()).toBe(true);
  });

  it('reserves the activity rail and separator before sizing a desktop list', () => {
    const normalizedSource = articleListSource.replace(/\s+/g, '');
    const tabletRule = normalizedSource.match(
      /@media\(min-width:768px\)\{\.article-list\{([^}]*)}/
    );
    const desktopRule = normalizedSource.match(
      /@media\(min-width:1280px\)\{\.article-list\{([^}]*)}/
    );

    expect(tabletRule?.[1]).toContain(
      'calc(100vw-var(--sidebar-rail-width,48px)-var(--panel-resize-handle-width,6px)-25rem)'
    );
    expect(desktopRule?.[1]).toContain(
      'calc(100vw-var(--sidebar-layout-width,328px)-var(--panel-resize-handle-width,6px)-25rem)'
    );
  });
});
