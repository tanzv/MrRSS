import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import ArticleItem from './ArticleItem.vue';

vi.mock('@/utils/mediaProxy', () => ({
  getProxiedMediaUrl: (url: string) => url,
  isMediaCacheEnabled: vi.fn().mockResolvedValue(false),
}));

const article: Article = {
  id: 1,
  feed_id: 1,
  feed_title: 'Example Feed',
  title: 'Keyboard-readable article',
  url: 'https://example.com/article',
  published_at: '2026-08-22T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

let wrapper: VueWrapper | undefined;

function mountArticleItem(isActive = false) {
  wrapper = mount(ArticleItem, {
    props: { article, isActive },
    global: {
      plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });

  return wrapper;
}

describe('ArticleItem keyboard access', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('exposes the active article as a focusable current item', () => {
    const mountedItem = mountArticleItem(true);
    const item = mountedItem.get('[data-article-id="1"]');

    expect(item.attributes('role')).toBe('button');
    expect(item.attributes('tabindex')).toBe('0');
    expect(item.attributes('aria-current')).toBe('true');
  });

  it('selects the article with Enter and Space', async () => {
    const mountedItem = mountArticleItem();
    const item = mountedItem.get('[data-article-id="1"]');

    await item.trigger('keydown', { key: 'Enter' });
    await item.trigger('keydown', { key: ' ' });

    expect(mountedItem.emitted('click')).toHaveLength(2);
  });
});
