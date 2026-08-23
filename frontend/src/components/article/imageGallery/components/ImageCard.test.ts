import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import ImageCard from './ImageCard.vue';

const article: Article = {
  id: 1,
  feed_id: 1,
  title: 'Gallery article',
  url: 'https://example.com/gallery-article',
  image_url: 'https://example.com/cover.jpg',
  feed_title: 'Gallery feed',
  published_at: '2026-08-22T00:00:00Z',
  is_read: false,
  is_favorite: true,
  is_hidden: false,
  is_read_later: false,
};

describe('ImageCard media theme contract', () => {
  it('uses semantic overlay and control classes for image chrome', () => {
    const wrapper = mount(ImageCard, {
      props: {
        article,
        imageCount: 3,
        showTextOverlay: false,
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    expect(wrapper.find('.media-overlay-hover').exists()).toBe(true);
    expect(wrapper.find('.media-text-overlay').exists()).toBe(true);
    expect(wrapper.find('.media-overlay-muted').exists()).toBe(true);
    expect(wrapper.find('.media-control').exists()).toBe(true);
    expect(wrapper.find('.state-favorite-text').exists()).toBe(true);
    expect(wrapper.find('.bg-black\\/60').exists()).toBe(false);
  });
});
