import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import en from './i18n/locales/en';
import App from './App.vue';
import { setSettingsFromRawData } from './composables/core/useSettings';
import { useAppStore } from './stores/app';
import { getRecommendedFonts } from './utils/fontDetector';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');

// Create stub components for complex child components
const createStub = (name: string) => ({
  name,
  template: `<div class="stub-component" data-component="${name}"><slot /></div>`,
});

function mountDesktopApp() {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;

  const pinia = createPinia();
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en },
  });
  const propAwareStub = (name: string) => ({
    name,
    props: ['isOpen', 'isCompact', 'isMobile', 'isSidebarOpen'],
    template: `<div class="article-list stub-component" data-component="${name}"></div>`,
  });
  const wrapper = mount(App, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        Sidebar: propAwareStub('Sidebar'),
        ArticleList: propAwareStub('ArticleList'),
        ArticleDetail: createStub('ArticleDetail'),
        ImageGalleryView: createStub('ImageGalleryView'),
        AddFeedModal: createStub('AddFeedModal'),
        EditFeedModal: createStub('EditFeedModal'),
        SettingsModal: createStub('SettingsModal'),
        DiscoverFeedsModal: createStub('DiscoverFeedsModal'),
        UpdateAvailableDialog: createStub('UpdateAvailableDialog'),
        ContextMenu: createStub('ContextMenu'),
        ConfirmDialog: createStub('ConfirmDialog'),
        InputDialog: createStub('InputDialog'),
        MultiSelectDialog: createStub('MultiSelectDialog'),
        Toast: createStub('Toast'),
      },
    },
  });

  return {
    wrapper,
    store: useAppStore(pinia),
    restoreMatchMedia: () => {
      window.matchMedia = originalMatchMedia;
    },
  };
}

describe('App', () => {
  it('passes compact navigation state to the sidebar and article list', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => {
      const matches = query === '(max-width: 1279px)' || query === '(max-width: 767px)';
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    });

    const pinia = createPinia();
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en },
    });
    const propAwareStub = (name: string) => ({
      name,
      props: ['isOpen', 'isCompact', 'isMobile', 'isSidebarOpen'],
      template: `<div class="stub-component" data-component="${name}"></div>`,
    });

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          Sidebar: propAwareStub('Sidebar'),
          ArticleList: propAwareStub('ArticleList'),
          ArticleDetail: createStub('ArticleDetail'),
          ImageGalleryView: createStub('ImageGalleryView'),
          AddFeedModal: createStub('AddFeedModal'),
          EditFeedModal: createStub('EditFeedModal'),
          SettingsModal: createStub('SettingsModal'),
          DiscoverFeedsModal: createStub('DiscoverFeedsModal'),
          UpdateAvailableDialog: createStub('UpdateAvailableDialog'),
          ContextMenu: createStub('ContextMenu'),
          ConfirmDialog: createStub('ConfirmDialog'),
          InputDialog: createStub('InputDialog'),
          MultiSelectDialog: createStub('MultiSelectDialog'),
          Toast: createStub('Toast'),
        },
      },
    });

    await nextTick();
    await flushPromises();

    expect(wrapper.findComponent({ name: 'Sidebar' }).props('isMobile')).toBe(true);
    expect(wrapper.findComponent({ name: 'Sidebar' }).props('isCompact')).toBe(true);
    expect(wrapper.findComponent({ name: 'ArticleList' }).props('isSidebarOpen')).toBe(false);

    const navigationTrigger = document.createElement('button');
    navigationTrigger.dataset.responsiveNavTrigger = 'true';
    const reader = document.createElement('main');
    reader.tabIndex = -1;
    document.body.append(navigationTrigger, reader);
    reader.focus();

    useAppStore(pinia).setReadingMode(true);
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(reader);

    wrapper.unmount();
    navigationTrigger.remove();
    reader.remove();
    window.matchMedia = originalMatchMedia;
  });

  it('renders and reacts to interface typography settings', async () => {
    setSettingsFromRawData({});
    const pinia = createPinia();
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en },
    });

    // Mock store methods
    const mockFetchFeeds = vi.fn();
    const mockFetchArticles = vi.fn();
    const mockInitTheme = vi.fn();

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          Sidebar: createStub('Sidebar'),
          ArticleList: createStub('ArticleList'),
          ArticleDetail: createStub('ArticleDetail'),
          ImageGalleryView: createStub('ImageGalleryView'),
          AddFeedModal: createStub('AddFeedModal'),
          EditFeedModal: createStub('EditFeedModal'),
          SettingsModal: createStub('SettingsModal'),
          DiscoverFeedsModal: createStub('DiscoverFeedsModal'),
          UpdateAvailableDialog: createStub('UpdateAvailableDialog'),
          ContextMenu: createStub('ContextMenu'),
          ConfirmDialog: createStub('ConfirmDialog'),
          InputDialog: createStub('InputDialog'),
          MultiSelectDialog: createStub('MultiSelectDialog'),
          Toast: createStub('Toast'),
        },
        mocks: {
          $window: {
            showToast: vi.fn(),
            showConfirm: vi.fn(() => Promise.resolve(true)),
          },
        },
      },
    });

    // Check that the app container is rendered
    expect(wrapper.find('.app-container').exists()).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--ui-font-family')).toContain(
      '-apple-system'
    );
    expect(document.documentElement.style.getPropertyValue('--ui-font-family')).not.toContain(
      'Inter'
    );
    expect(document.documentElement.style.getPropertyValue('--ui-font-size')).toBe('16px');
    expect(document.documentElement.style.getPropertyValue('--ui-font-scale')).toBe('1');

    setSettingsFromRawData({
      ui_font_family: 'serif',
      ui_font_size: '8',
    });
    await nextTick();

    expect(document.documentElement.style.getPropertyValue('--ui-font-family')).toContain(
      'Georgia'
    );
    expect(document.documentElement.style.getPropertyValue('--ui-font-size')).toBe('12px');
    expect(document.documentElement.style.getPropertyValue('--ui-font-scale')).toBe('0.75');

    setSettingsFromRawData({
      ui_font_family: 'serif',
      ui_font_size: '24',
    });
    await nextTick();

    expect(document.documentElement.style.getPropertyValue('--ui-font-size')).toBe('20px');
    expect(document.documentElement.style.getPropertyValue('--ui-font-scale')).toBe('1.25');

    setSettingsFromRawData({
      ui_font_family: 'Noto Sans SC',
      ui_font_size: '16',
    });
    await nextTick();

    expect(document.documentElement.style.getPropertyValue('--ui-font-family')).toContain(
      '"Noto Sans SC"'
    );
    expect(document.documentElement.style.getPropertyValue('--ui-font-family')).toContain(
      'system-ui'
    );

    wrapper.unmount();
    expect(document.documentElement.style.getPropertyValue('--ui-font-family')).toBe('');
  });

  it('applies the active custom profile without changing reader typography settings', async () => {
    const profile = {
      id: 'focus',
      name: 'Focus',
      basePreset: 'paper',
      appearance: 'light',
      light: { 'accent-color': '#123456' },
      dark: {},
      uiFontFamily: 'serif',
      uiFontSize: 18,
      updatedAt: '2026-08-23T00:00:00.000Z',
    };
    setSettingsFromRawData({
      theme: 'custom:focus',
      theme_profiles: JSON.stringify([profile]),
      content_font_family: 'monospace',
      content_font_size: '22',
    });
    const defaultFetch = vi.mocked(global.fetch).getMockImplementation();
    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/settings') {
        return {
          ok: true,
          json: async () => ({
            theme: 'custom:focus',
            theme_profiles: JSON.stringify([profile]),
            layout_mode: 'normal',
            update_interval: '30',
            update_check_enabled: 'false',
          }),
        } as Response;
      }
      return defaultFetch?.(input, init) ?? ({ ok: true, json: async () => ({}) } as Response);
    });
    const pinia = createPinia();
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en },
    });
    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          Sidebar: createStub('Sidebar'),
          ArticleList: createStub('ArticleList'),
          ArticleDetail: createStub('ArticleDetail'),
          ImageGalleryView: createStub('ImageGalleryView'),
          AddFeedModal: createStub('AddFeedModal'),
          EditFeedModal: createStub('EditFeedModal'),
          SettingsModal: createStub('SettingsModal'),
          DiscoverFeedsModal: createStub('DiscoverFeedsModal'),
          UpdateAvailableDialog: createStub('UpdateAvailableDialog'),
          ContextMenu: createStub('ContextMenu'),
          ConfirmDialog: createStub('ConfirmDialog'),
          InputDialog: createStub('InputDialog'),
          MultiSelectDialog: createStub('MultiSelectDialog'),
          Toast: createStub('Toast'),
        },
      },
    });

    await nextTick();
    await flushPromises();
    const appStore = useAppStore(pinia);
    expect(appStore.themePreference).toBe('custom:focus');
    expect(document.documentElement.style.getPropertyValue('--accent-color')).toBe('#123456');
    expect(document.documentElement.style.getPropertyValue('--ui-font-size')).toBe('18px');
    expect(document.documentElement.style.getPropertyValue('--ui-font-family')).toContain(
      'Georgia'
    );

    wrapper.unmount();
    vi.mocked(global.fetch).mockImplementation(defaultFetch);
  });

  it('detects the expanded Chinese font catalog in the expected groups', () => {
    let currentFont = '';
    const context = {
      get font() {
        return currentFont;
      },
      set font(value: string) {
        currentFont = value;
      },
      measureText: () => ({ width: currentFont === '100px sans-serif' ? 100 : 200 }),
    };
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);

    const fonts = getRecommendedFonts();

    expect(fonts.sansSerif).toEqual(
      expect.arrayContaining([
        'Noto Sans SC',
        'Source Han Sans CN',
        'Sarasa Gothic SC',
        'Sarasa UI SC',
      ])
    );
    expect(fonts.serif).toEqual(
      expect.arrayContaining([
        'Noto Serif SC',
        'Source Han Serif CN',
        'LXGW WenKai',
        'LXGW WenKai GB',
        'LXGW WenKai Lite',
        'LXGW WenKai Screen',
      ])
    );

    getContextSpy.mockRestore();
  });

  it('hides the desktop sidebar while keeping the reader article list mounted', async () => {
    setSettingsFromRawData({});
    const pinia = createPinia();
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en },
    });
    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          Sidebar: createStub('Sidebar'),
          ArticleList: createStub('ArticleList'),
          ArticleDetail: createStub('ArticleDetail'),
          ImageGalleryView: createStub('ImageGalleryView'),
          AddFeedModal: createStub('AddFeedModal'),
          EditFeedModal: createStub('EditFeedModal'),
          SettingsModal: createStub('SettingsModal'),
          DiscoverFeedsModal: createStub('DiscoverFeedsModal'),
          UpdateAvailableDialog: createStub('UpdateAvailableDialog'),
          ContextMenu: createStub('ContextMenu'),
          ConfirmDialog: createStub('ConfirmDialog'),
          InputDialog: createStub('InputDialog'),
          MultiSelectDialog: createStub('MultiSelectDialog'),
          Toast: createStub('Toast'),
        },
      },
    });
    const store = useAppStore(pinia);

    store.setReadingMode(true);
    await nextTick();

    expect(wrapper.get('.app-container').attributes('data-reading-mode')).toBe('true');
    expect(wrapper.get('[data-testid="reading-sidebar-container"]').classes()).toContain(
      'md:hidden'
    );
    expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).toContain(
      'reader-article-list-edge-shell'
    );
    expect(wrapper.find('[data-component="Sidebar"]').exists()).toBe(true);
    expect(wrapper.find('[data-component="ArticleList"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('reveals only the article list when the desktop reader edge is entered', async () => {
    const { wrapper, store, restoreMatchMedia } = mountDesktopApp();

    try {
      store.setReadingMode(true);
      await nextTick();

      const edge = wrapper.get('[data-testid="reader-article-list-edge"]');
      edge.element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      await nextTick();

      expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).toContain(
        'is-revealed'
      );
      expect(wrapper.get('[data-testid="reading-sidebar-container"]').classes()).toContain(
        'md:hidden'
      );

      vi.useFakeTimers();
      wrapper
        .get('[data-testid="reading-article-list-container"]')
        .element.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      vi.advanceTimersByTime(180);
      await nextTick();

      expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).not.toContain(
        'is-revealed'
      );
    } finally {
      vi.useRealTimers();
      wrapper.unmount();
      restoreMatchMedia();
    }
  });

  it('keeps the collapsed reader edge visually transparent', () => {
    expect(appSource).toMatch(
      /\.reader-article-list-edge-shell\s*\{[\s\S]*?background-color:\s*transparent;/
    );
    expect(appSource).toMatch(
      /\.reader-article-list-edge-trigger\s*\{[\s\S]*?background:\s*transparent;/
    );
    expect(appSource).not.toContain(
      'background: color-mix(in srgb, var(--accent-color) 55%, transparent)'
    );
  });

  it('reveals the article list when the invisible edge receives keyboard focus', async () => {
    const { wrapper, store, restoreMatchMedia } = mountDesktopApp();

    try {
      store.setReadingMode(true);
      await nextTick();
      await wrapper.get('[data-testid="reader-article-list-edge"]').trigger('focusin');

      expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).toContain(
        'is-revealed'
      );
    } finally {
      wrapper.unmount();
      restoreMatchMedia();
    }
  });

  it('retracts the temporary reader list after selecting another article', async () => {
    const { wrapper, store, restoreMatchMedia } = mountDesktopApp();

    try {
      store.setReadingMode(true);
      await nextTick();

      wrapper
        .get('[data-testid="reader-article-list-edge"]')
        .element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      await nextTick();

      store.currentArticleId = 42;
      await nextTick();

      expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).not.toContain(
        'is-revealed'
      );
    } finally {
      wrapper.unmount();
      restoreMatchMedia();
    }
  });

  it('resizes the desktop article list through its accessible separator', async () => {
    localStorage.removeItem('mrrss.article-list-width');
    setSettingsFromRawData({ layout_mode: 'normal' });
    const { wrapper, restoreMatchMedia } = mountDesktopApp();

    try {
      await nextTick();
      await flushPromises();

      const handle = wrapper.get('[data-testid="article-list-resize-handle"]');
      expect(handle.attributes('aria-label')).toBe('Resize article list');
      expect(handle.attributes('aria-valuemin')).toBe('280');
      expect(handle.attributes('aria-valuemax')).toBe('600');

      await handle.trigger('keydown', { key: 'ArrowRight' });
      await nextTick();

      expect(
        wrapper.get('.app-container').element.style.getPropertyValue('--article-list-width')
      ).toBe('366px');
      expect(localStorage.getItem('mrrss.article-list-width')).toBe('366');
    } finally {
      wrapper.unmount();
      restoreMatchMedia();
      localStorage.removeItem('mrrss.article-list-width');
    }
  });
});
