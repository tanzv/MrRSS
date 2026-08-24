import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article } from '@/types/models';
import type { ReaderTypographyPresetId } from '@/utils/readerTypography';
import en from '@/i18n/locales/en';
import ArticleTitle from './ArticleTitle.vue';

const article: Article = {
  id: 1,
  feed_id: 1,
  feed_title: 'Example Feed',
  title: 'Example article',
  url: 'https://example.com/article',
  published_at: '2026-08-23T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

function mountTitle(readerStyle: ReaderTypographyPresetId | 'custom') {
  return mount(ArticleTitle, {
    props: {
      article,
      translatedTitle: '',
      isTranslatingTitle: false,
      translationEnabled: false,
      readerStyle,
    },
    global: {
      plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

describe('ArticleTitle reader style', () => {
  it('adds editorial title rhythm only for Magazine', () => {
    const wrapper = mountTitle('magazine');

    expect(wrapper.get('h1').classes()).toContain('article-title--magazine');
    expect(wrapper.get('[data-testid="article-title-meta"]').classes()).toContain(
      'article-title-meta--magazine'
    );
  });

  it('keeps the neutral title rhythm for custom typography', () => {
    const wrapper = mountTitle('custom');

    expect(wrapper.get('h1').classes()).not.toContain('article-title--magazine');
    expect(wrapper.get('[data-testid="article-title-meta"]').classes()).not.toContain(
      'article-title-meta--magazine'
    );
  });
});
