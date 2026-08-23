import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import ArticleContinuation from './ArticleContinuation.vue';

const nextArticle: Article = {
  id: 2,
  feed_id: 1,
  feed_title: 'Daily Briefing',
  title: 'The next article in the queue',
  url: 'https://example.com/next',
  published_at: '2026-08-22T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

describe('ArticleContinuation', () => {
  it('presents the next article and emits only a navigation intent', async () => {
    const wrapper = mount(ArticleContinuation, {
      props: { nextArticle },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    expect(wrapper.get('[data-testid="article-continuation"]').text()).toContain(nextArticle.title);
    expect(wrapper.text()).toContain('Daily Briefing');

    await wrapper.get('[data-testid="article-continuation-next"]').trigger('click');

    expect(wrapper.emitted('navigateNext')).toEqual([[]]);
  });
});
