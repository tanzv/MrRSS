import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import en from '@/i18n/locales/en';
import type { Article } from '@/types/models';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
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

const mountedToolbars: VueWrapper[] = [];

function mountToolbar(
  props: {
    showContent?: boolean;
    showTranslations?: boolean;
    translationDisplayMode?: 'original' | 'bilingual' | 'translation';
    showContents?: boolean;
    isModal?: boolean;
    isReadingMode?: boolean;
    readingProgress?: number | null;
    hasReaderContent?: boolean;
    hasPreviousArticle?: boolean;
    hasNextArticle?: boolean;
    restoredReadingProgress?: number | null;
    restoreContentsFocus?: boolean;
  } = {},
  attachToDocument = false
) {
  const wrapper = mount(ArticleToolbar, {
    attachTo: attachToDocument ? document.body : undefined,
    props: {
      article,
      showContent: false,
      ...props,
    },
    global: {
      plugins: [
        createPinia(),
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en },
        }),
      ],
      stubs: {
        ReaderAppearancePanel: {
          name: 'ReaderAppearancePanel',
          props: ['saveState'],
          emits: ['close', 'restore-default-typography', 'update-canvas'],
          template: '<div />',
        },
      },
    },
  });
  mountedToolbars.push(wrapper);
  return wrapper;
}

afterEach(() => {
  mountedToolbars.splice(0).forEach((wrapper) => wrapper.unmount());
  setSettingsFromRawData({});
  vi.clearAllMocks();
});

describe('ArticleToolbar', () => {
  it('shows a desktop close control for the original webpage view', async () => {
    const wrapper = mountToolbar();

    const closeButton = wrapper.get('[data-testid="close-article"]');
    expect(closeButton.classes()).not.toContain('md:hidden');
    expect(closeButton.attributes('title')).toBe('Close');

    await closeButton.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('uses a shared panel header and icon action controls', () => {
    const wrapper = mountToolbar({ showContent: true });

    expect(wrapper.get('.app-panel-header').exists()).toBe(true);
    expect(wrapper.get('[data-testid="toggle-reading-mode"]').classes()).toContain(
      'ui-icon-button'
    );
  });

  it('shows an accessible exit control and progress while reading', async () => {
    const wrapper = mountToolbar({
      showContent: true,
      isReadingMode: true,
      readingProgress: 42,
    });

    const readingModeButton = wrapper.get('[data-testid="reader-exit"]');
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
    ).toContain('transform: scaleX(0.42)');
    expect(wrapper.find('[data-testid="reading-toolbar-divider"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="close-article"]').exists()).toBe(false);

    await readingModeButton.trigger('click');

    expect(wrapper.emitted('toggleReadingMode')).toHaveLength(1);
  });

  it('keeps named reader controls visible and moves article state actions into More', async () => {
    const wrapper = mountToolbar(
      { showContent: true, isReadingMode: true, hasReaderContent: true },
      true
    );

    const exit = wrapper.get('[data-testid="reader-exit"]');
    expect(exit.text()).toContain('Exit reading mode');

    await wrapper.get('[data-testid="reader-find"]').trigger('click');
    await wrapper.get('[data-testid="reader-contents"]').trigger('click');
    expect(wrapper.emitted('openFind')).toEqual([[]]);
    expect(wrapper.emitted('toggleContents')).toEqual([[]]);

    const more = wrapper.get('[data-testid="reader-more-trigger"]');
    expect(more.attributes('aria-expanded')).toBe('false');
    await more.trigger('click');

    expect(more.attributes('aria-expanded')).toBe('true');
    const readAction = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="reader-menu-toggle-read"]'
    );
    expect(readAction?.textContent).toContain('Mark as Read');
    readAction?.click();
    await nextTick();

    expect(wrapper.emitted('toggleRead')).toEqual([[]]);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    wrapper.unmount();
  });

  it('keeps reader navigation, translation state, and a restored position reachable', async () => {
    const wrapper = mountToolbar(
      {
        showContent: true,
        isReadingMode: true,
        hasReaderContent: true,
        hasPreviousArticle: true,
        hasNextArticle: true,
        translationDisplayMode: 'translation',
        restoredReadingProgress: 42,
      },
      true
    );
    setSettingsFromRawData({ translation_enabled: 'true' });
    await nextTick();

    expect(wrapper.get('[data-testid="reader-translation-state"]').text()).toContain(
      'Translation only'
    );
    expect(wrapper.get('[data-testid="reader-translation-state"]').attributes('aria-live')).toBe(
      'polite'
    );

    await wrapper.get('[data-testid="reader-previous"]').trigger('click');
    await wrapper.get('[data-testid="reader-next"]').trigger('click');
    await wrapper.get('[data-testid="reader-resume-status"]').trigger('click');
    expect(wrapper.emitted('navigatePrevious')).toEqual([[]]);
    expect(wrapper.emitted('navigateNext')).toEqual([[]]);
    expect(wrapper.emitted('scrollToTop')).toEqual([[]]);

    await wrapper.get('[data-testid="reader-more-trigger"]').trigger('click');
    await nextTick();
    const findAction = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="reader-menu-find"]'
    );
    expect(findAction?.textContent).toContain('Find in article');
    findAction?.click();
    await nextTick();
    expect(wrapper.emitted('openFind')).toEqual([[]]);

    await wrapper.get('[data-testid="reader-more-trigger"]').trigger('click');
    await nextTick();
    document.body.querySelector<HTMLButtonElement>('[data-testid="reader-menu-next"]')?.click();
    expect(wrapper.emitted('navigateNext')).toEqual([[], []]);
    wrapper.unmount();
  });

  it('keeps Find and appearance in More on compact reader toolbars', () => {
    const wrapper = mountToolbar({
      showContent: true,
      isReadingMode: true,
      hasReaderContent: true,
    });

    expect(wrapper.get('[data-testid="reader-find"]').classes()).toContain('hidden');
    expect(wrapper.get('[data-testid="reader-find"]').classes()).toContain('md:inline-flex');
    expect(wrapper.get('[data-testid="reader-appearance-trigger"]').classes()).toContain('hidden');
    expect(wrapper.get('[data-testid="reader-appearance-trigger"]').classes()).toContain(
      'md:inline-flex'
    );
  });

  it('keeps reader tools reachable from the card modal session', () => {
    const wrapper = mountToolbar({
      showContent: true,
      isModal: true,
      isReadingMode: true,
      hasReaderContent: true,
    });

    expect(wrapper.find('[data-testid="reader-exit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="reader-find"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="reader-contents"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="reader-appearance-trigger"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="reader-more-trigger"]').exists()).toBe(true);
  });

  it('moves focus through the reader More menu and restores it on Escape', async () => {
    const wrapper = mountToolbar(
      { showContent: true, isReadingMode: true, hasReaderContent: true },
      true
    );
    const trigger = wrapper.get('[data-testid="reader-more-trigger"]');

    await trigger.trigger('click');
    await nextTick();

    const menuItems = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')
    );
    expect(document.activeElement).toBe(menuItems[0]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(menuItems[1]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(menuItems.at(-1));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();
  });

  it('offers explicit original, bilingual, and translated reader displays', async () => {
    const wrapper = mountToolbar(
      { showContent: true, isReadingMode: true, hasReaderContent: true },
      true
    );
    await flushPromises();
    setSettingsFromRawData({ translation_enabled: 'true', translation_only_mode: 'false' });
    await nextTick();

    await wrapper.get('[data-testid="reader-more-trigger"]').trigger('click');
    await nextTick();

    const bilingual = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="reader-translation-bilingual"]'
    );
    const translated = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="reader-translation-translation"]'
    );
    expect(
      document.body.querySelector('[data-testid="reader-translation-original"]')
    ).not.toBeNull();
    expect(bilingual?.getAttribute('aria-checked')).toBe('true');

    translated?.click();
    await nextTick();

    expect(wrapper.emitted('setTranslationDisplayMode')).toEqual([['translation']]);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(wrapper.get('[data-testid="reader-more-trigger"]').element);
  });

  it('restores focus to Contents after the contents sheet closes', async () => {
    const wrapper = mountToolbar(
      { showContent: true, isReadingMode: true, hasReaderContent: true, showContents: true },
      true
    );
    const contents = wrapper.get('[data-testid="reader-contents"]');

    await wrapper.setProps({ showContents: false });
    await nextTick();

    expect(document.activeElement).toBe(contents.element);
  });

  it('does not steal focus from a selected contents heading', async () => {
    const wrapper = mountToolbar(
      {
        showContent: true,
        isReadingMode: true,
        hasReaderContent: true,
        showContents: true,
        restoreContentsFocus: false,
      },
      true
    );
    const otherFocusTarget = document.createElement('button');
    document.body.append(otherFocusTarget);
    otherFocusTarget.focus();

    await wrapper.setProps({ showContents: false });
    await nextTick();

    expect(document.activeElement).toBe(otherFocusTarget);
    otherFocusTarget.remove();
    wrapper.unmount();
  });

  it('keeps the reading-mode exit control available over the original webpage', async () => {
    const wrapper = mountToolbar({
      showContent: false,
      isReadingMode: true,
    });

    const readingModeButton = wrapper.get('[data-testid="reader-exit"]');
    expect(readingModeButton.attributes('aria-pressed')).toBe('true');
    expect(readingModeButton.attributes('aria-label')).toBe('Exit reading mode');
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
      'transform: scaleX(1)'
    );
  });

  it('hides reader progress when the article does not have a scroll range', () => {
    const wrapper = mountToolbar({
      showContent: true,
      isReadingMode: true,
      readingProgress: null,
    });

    expect(wrapper.find('[data-testid="reading-progress"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="reading-progress-track"]').exists()).toBe(false);
  });

  it('shows an expanded-state appearance trigger only in active reading mode and restores focus on close', async () => {
    const wrapper = mountToolbar(
      { showContent: true, isReadingMode: true, hasReaderContent: true },
      true
    );
    const trigger = wrapper.get('[data-testid="reader-appearance-trigger"]');

    expect(trigger.attributes('aria-expanded')).toBe('false');
    await trigger.trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('true');

    const panel = wrapper.getComponent({ name: 'ReaderAppearancePanel' });
    expect(panel.props('saveState')).toBe('idle');
    vi.mocked(global.fetch).mockClear();
    panel.vm.$emit('update-canvas', {
      content_background_color: '#111111',
      content_text_color: '#ffffff',
    });
    panel.vm.$emit('close');
    await flushPromises();
    await nextTick();

    const save = vi
      .mocked(global.fetch)
      .mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(save).toBeDefined();
    expect(JSON.parse((save?.[1] as RequestInit).body as string)).toMatchObject({
      content_background_color: '#111111',
      content_text_color: '#ffffff',
    });
    expect(document.activeElement).toBe(trigger.element);

    await wrapper.setProps({ isReadingMode: false });
    expect(wrapper.find('[data-testid="reader-appearance-trigger"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
