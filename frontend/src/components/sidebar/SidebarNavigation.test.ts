import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import en from '@/i18n/locales/en';
import ActivityBar from './ActivityBar.vue';
import SidebarCategory from './SidebarCategory.vue';
import SidebarFeed from './SidebarFeed.vue';
import type { Feed } from '@/types/models';

let wrappers: VueWrapper[] = [];

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en },
});

const feed = {
  id: 1,
  title: 'Daily Feed',
  url: 'https://example.com/feed.xml',
  category: 'News',
  is_freshrss_source: false,
  is_image_mode: false,
  hide_from_timeline: false,
  last_error: '',
} as Feed;

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount());
  wrappers = [];
});

describe('reader navigation semantics', () => {
  it('labels activity controls and exposes the active filter', async () => {
    const wrapper = mount(ActivityBar, {
      global: { plugins: [createPinia(), i18n] },
    });
    wrappers.push(wrapper);
    await nextTick();

    const allArticles = wrapper.find('button[title="All Articles"]');
    expect(allArticles.attributes('aria-label')).toBe('All Articles');
    expect(allArticles.attributes('aria-current')).toBe('page');
    expect(wrapper.find('nav').attributes('aria-label')).toBe('Article filters');
  });

  it('allows category selection and expansion from the keyboard', async () => {
    const wrapper = mount(SidebarCategory, {
      props: {
        name: 'News',
        feeds: [feed],
        isOpen: true,
        isActive: false,
        unreadCount: 2,
        currentFeedId: null,
        feedUnreadCounts: { 1: 2 },
      },
      global: { plugins: [i18n] },
    });
    wrappers.push(wrapper);

    const header = wrapper.find('.category-header');
    expect(header.attributes('role')).toBe('button');
    expect(header.attributes('tabindex')).toBe('0');
    expect(header.attributes('aria-expanded')).toBe('true');

    await header.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('selectCategory')).toHaveLength(1);
  });

  it('allows feed selection from the keyboard and exposes current state', async () => {
    const wrapper = mount(SidebarFeed, {
      props: {
        feed,
        isActive: true,
        unreadCount: 1,
      },
      global: { plugins: [i18n] },
    });
    wrappers.push(wrapper);

    const item = wrapper.find('.feed-item');
    expect(item.attributes('role')).toBe('button');
    expect(item.attributes('tabindex')).toBe('0');
    expect(item.attributes('aria-current')).toBe('page');

    await item.trigger('keydown', { key: ' ' });
    expect(wrapper.emitted('click')).toHaveLength(1);
  });
});
