import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import en from '@/i18n/locales/en';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
import { useAppStore } from '@/stores/app';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

let wrapper: VueWrapper | undefined;

function mountShortcuts() {
  const pinia = createPinia();
  let store: ReturnType<typeof useAppStore> | undefined;
  let shortcuts: ReturnType<typeof useKeyboardShortcuts> | undefined;

  wrapper = mount(
    defineComponent({
      setup() {
        store = useAppStore();
        shortcuts = useKeyboardShortcuts({
          onOpenSettings: vi.fn(),
          onAddFeed: vi.fn(),
          onMarkAllRead: vi.fn(async () => {}),
        });
        return () => h('div');
      },
    }),
    {
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    }
  );

  return { store: store!, shortcuts: shortcuts! };
}

function pressKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts reading mode', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
    setSettingsFromRawData({});
  });

  it('dispatches a dedicated reading-mode event for the default M shortcut', async () => {
    const { shortcuts } = mountShortcuts();
    const onToggleReadingMode = vi.fn();
    window.addEventListener('toggle-reading-mode', onToggleReadingMode);
    await nextTick();

    pressKey('m');

    expect(shortcuts.shortcuts.value.toggleReadingMode).toBe('m');
    expect(onToggleReadingMode).toHaveBeenCalledTimes(1);
    window.removeEventListener('toggle-reading-mode', onToggleReadingMode);
  });

  it('keeps V dedicated to switching between RSS content and the original webpage', async () => {
    mountShortcuts();
    const onToggleContent = vi.fn();
    const onToggleReadingMode = vi.fn();
    window.addEventListener('toggle-content-view', onToggleContent);
    window.addEventListener('toggle-reading-mode', onToggleReadingMode);
    await nextTick();

    pressKey('v');

    expect(onToggleContent).toHaveBeenCalledTimes(1);
    expect(onToggleReadingMode).not.toHaveBeenCalled();
    window.removeEventListener('toggle-content-view', onToggleContent);
    window.removeEventListener('toggle-reading-mode', onToggleReadingMode);
  });

  it('exits reading mode before closing the selected article on Escape', async () => {
    const { store } = mountShortcuts();
    await nextTick();
    store.currentArticleId = 42;
    store.setReadingMode(true);

    const firstEscape = pressKey('Escape');

    expect(firstEscape.defaultPrevented).toBe(true);
    expect(store.isReadingMode).toBe(false);
    expect(store.currentArticleId).toBe(42);

    const secondEscape = pressKey('Escape');

    expect(secondEscape.defaultPrevented).toBe(true);
    expect(store.currentArticleId).toBeNull();
  });

  it('does not mark an RSS article while keyboard navigation waits for scroll progress', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) });
    vi.stubGlobal('fetch', fetchMock);
    setSettingsFromRawData({ mark_read_on_scroll: 'true' });
    const { store } = mountShortcuts();
    store.articles = [
      {
        id: 9,
        feed_id: 1,
        title: 'Unread RSS article',
        url: 'https://example.com/article',
        published_at: '2026-08-22T00:00:00Z',
        is_read: false,
        is_favorite: false,
        is_hidden: false,
        is_read_later: false,
      },
    ];
    await nextTick();

    pressKey('j');

    expect(store.currentArticleId).toBe(9);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/articles/read'))
    ).toHaveLength(0);
  });
});
