import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import type { Article } from '@/types/models';
import ArticleToolbar from './ArticleToolbar.vue';

const article: Article = {
  id: 1,
  feed_id: 1,
  title: 'Example article',
  url: 'https://example.com/article',
  published_at: '2026-08-21T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

function mountToolbar(
  props: {
    showContent?: boolean;
    isReadingMode?: boolean;
    readingProgress?: number;
  } = {}
) {
  return mount(ArticleToolbar, {
    props: {
      article,
      showContent: false,
      ...props,
    },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en },
        }),
      ],
    },
  });
}

describe('ArticleToolbar', () => {
  it('shows a desktop close control for the original webpage view', async () => {
    const wrapper = mountToolbar();

    const closeButton = wrapper.get('[data-testid="close-article"]');
    expect(closeButton.classes()).not.toContain('md:hidden');
    expect(closeButton.attributes('title')).toBe('Close');

    await closeButton.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('shows an accessible exit control and progress while reading', async () => {
    const wrapper = mountToolbar({
      showContent: true,
      isReadingMode: true,
      readingProgress: 42,
    });

    const readingModeButton = wrapper.get('[data-testid="toggle-reading-mode"]');
    expect(readingModeButton.attributes('aria-pressed')).toBe('true');
    expect(readingModeButton.attributes('aria-label')).toBe('Exit reading mode');
    const progress = wrapper.get('[data-testid="reading-progress"]');
    expect(progress.text()).toBe('42%');
    expect(progress.attributes('role')).toBe('progressbar');
    expect(progress.attributes('aria-valuemin')).toBe('0');
    expect(progress.attributes('aria-valuemax')).toBe('100');
    expect(progress.attributes('aria-valuenow')).toBe('42');
    expect(
      wrapper
        .get('[data-testid="reading-progress-track"] [data-testid="reading-progress-fill"]')
        .attributes('style')
    ).toContain('width: 42%');
    expect(wrapper.find('[data-testid="reading-toolbar-divider"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="close-article"]').exists()).toBe(false);

    await readingModeButton.trigger('click');

    expect(wrapper.emitted('toggleReadingMode')).toHaveLength(1);
  });

  it('names the mobile back action', () => {
    const wrapper = mountToolbar();

    const backButton = wrapper.get('[data-testid="mobile-back"]');
    expect(backButton.attributes('aria-label')).toBe('Back');
    expect(backButton.attributes('title')).toBe('Back');
  });

  it('bounds the reading progressbar to its valid range', () => {
    const wrapper = mountToolbar({
      showContent: true,
      isReadingMode: true,
      readingProgress: 125,
    });

    expect(wrapper.get('[data-testid="reading-progress"]').attributes('aria-valuenow')).toBe('100');
    expect(wrapper.get('[data-testid="reading-progress-fill"]').attributes('style')).toContain(
      'width: 100%'
    );
  });
});
