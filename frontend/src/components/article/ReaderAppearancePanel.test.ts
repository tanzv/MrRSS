import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import FontFamilySelect from '@/components/settings/FontFamilySelect.vue';
import ReaderCanvasColorControls from '@/components/settings/ReaderCanvasColorControls.vue';
import { useKeyboardShortcuts } from '@/composables/ui/useKeyboardShortcuts';
import { useAppStore } from '@/stores/app';
import type { ReaderTypographyInput } from '@/utils/readerTypography';
import en from '@/i18n/locales/en';
import ReaderAppearancePanel from './ReaderAppearancePanel.vue';

vi.mock('@/utils/fontDetector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/fontDetector')>();

  return {
    ...actual,
    getRecommendedFonts: () => ({ serif: [], sansSerif: [], monospace: [] }),
  };
});

const focusSettings: ReaderTypographyInput = {
  content_font_family: 'system',
  content_font_size: 16,
  content_line_height: '1.6',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
};

const mountedPanels: Array<VueWrapper<InstanceType<typeof ReaderAppearancePanel>>> = [];
const mountedAnchors: HTMLElement[] = [];
let shortcutHost: VueWrapper | undefined;

function mountReadingModeShortcuts(): ReturnType<typeof useAppStore> {
  const pinia = createPinia();
  let store: ReturnType<typeof useAppStore> | undefined;

  shortcutHost = mount(
    defineComponent({
      setup() {
        store = useAppStore();
        useKeyboardShortcuts({
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

  return store!;
}

function mockAppearanceMedia(mobile: boolean): void {
  window.matchMedia = vi.fn(() => ({
    matches: mobile,
    media: '(max-width: 639px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function getPanelElement(): HTMLElement {
  const panel = Array.from(
    document.body.querySelectorAll<HTMLElement>('[data-testid="reader-appearance-panel"]')
  ).at(-1);
  if (!panel)
    throw new Error('Expected the reader appearance panel to be teleported to the document body');

  return panel;
}

function mountPanel(options: {
  mobile: boolean;
  settings?: ReaderTypographyInput;
  saveError?: boolean;
  saveState?: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
}) {
  mockAppearanceMedia(options.mobile);
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () =>
    ({ left: 360, top: 12, right: 404, bottom: 56, width: 44, height: 44 }) as DOMRect;
  document.body.append(anchor);
  mountedAnchors.push(anchor);

  const wrapper = mount(ReaderAppearancePanel, {
    attachTo: document.body,
    props: {
      anchor,
      settings: options.settings ?? focusSettings,
      saveError: options.saveError ?? false,
      saveState: options.saveState ?? 'idle',
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        ReaderTypographyPreview: {
          name: 'ReaderTypographyPreview',
          template: '<div data-testid="reader-typography-preview" />',
        },
      },
    },
  });
  mountedPanels.push(wrapper);

  return wrapper;
}

afterEach(() => {
  shortcutHost?.unmount();
  shortcutHost = undefined;
  mountedPanels.splice(0).forEach((wrapper) => wrapper.unmount());
  mountedAnchors.splice(0).forEach((anchor) => anchor.remove());
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('ReaderAppearancePanel', () => {
  it('emits precise typography patches from desktop controls', async () => {
    const wrapper = mountPanel({ mobile: false });
    const panel = getPanelElement();

    await panel.querySelector<HTMLButtonElement>('[data-testid="reader-font-increase"]')?.click();
    await panel.querySelector<HTMLButtonElement>('[data-testid="reader-density-relaxed"]')?.click();
    await panel.querySelector<HTMLButtonElement>('[data-testid="reader-width-narrow"]')?.click();

    expect(wrapper.emitted('update-typography')).toEqual([
      [{ content_font_size: 17 }],
      [{ content_line_height: '1.8', content_paragraph_spacing: 'relaxed' }],
      [{ content_width: 'narrow' }],
    ]);
  });

  it('forwards a local font-family selection as a typography patch', () => {
    const wrapper = mountPanel({ mobile: false });

    wrapper.findComponent(FontFamilySelect).vm.$emit('update:modelValue', 'PingFang SC');

    expect(wrapper.emitted('update-typography')).toEqual([
      [{ content_font_family: 'PingFang SC' }],
    ]);
  });

  it('forwards a complete canvas pair from the reader appearance panel', () => {
    const wrapper = mountPanel({ mobile: false });

    wrapper.findComponent(ReaderCanvasColorControls).vm.$emit('update:canvas', {
      content_background_color: '#111111',
      content_text_color: '#ffffff',
    });

    expect(wrapper.emitted('update-canvas')).toEqual([
      [{ content_background_color: '#111111', content_text_color: '#ffffff' }],
    ]);
  });

  it('keeps quick typography controls visible while advanced appearance controls stay collapsed', () => {
    mountPanel({ mobile: false, saveState: 'saved' });
    const panel = getPanelElement();
    const fontControl = panel.querySelector('[data-testid="reader-font-family-control"]');
    const sizeControl = panel.querySelector('[data-testid="reader-font-size-control"]');
    const advanced = panel.querySelector<HTMLDetailsElement>(
      '[data-testid="reader-appearance-advanced"]'
    );

    expect(panel.querySelectorAll('[role="radio"]')).toHaveLength(4);
    expect(fontControl).not.toBeNull();
    expect(sizeControl).not.toBeNull();
    expect(fontControl?.compareDocumentPosition(sizeControl!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(panel.querySelector('[data-testid="reader-typography-preview"]')).not.toBeNull();
    expect(advanced?.open).toBe(false);
    expect(
      panel.querySelector('[data-testid="reader-appearance-save-status"]')?.textContent
    ).toContain('Saved');
  });

  it('disables font-size endpoints and exposes explicit restore and retry commands', async () => {
    mountPanel({ mobile: false, settings: { ...focusSettings, content_font_size: 10 } });
    expect(
      getPanelElement()
        .querySelector('[data-testid="reader-font-decrease"]')
        ?.getAttribute('disabled')
    ).not.toBeNull();

    const max = mountPanel({
      mobile: false,
      settings: { ...focusSettings, content_font_size: 24 },
      saveError: true,
    });
    const panel = getPanelElement();
    expect(
      panel.querySelector('[data-testid="reader-font-increase"]')?.getAttribute('disabled')
    ).not.toBeNull();
    panel.querySelector<HTMLButtonElement>('[data-testid="reader-appearance-restore"]')?.click();
    panel.querySelector<HTMLButtonElement>('[data-testid="reader-appearance-retry"]')?.click();

    expect(max.emitted('restore-default-typography')).toEqual([[]]);
    expect(max.emitted('retry-save')).toEqual([[]]);
  });

  it('uses a mobile dialog, hides width, traps focus, and closes on Escape', async () => {
    const previousOverflow = document.body.style.overflow;
    const wrapper = mountPanel({ mobile: true });
    await nextTick();
    const panel = getPanelElement();
    const focusable = Array.from(
      panel.querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([tabindex="-1"])')
    );

    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(document.body.querySelector('[data-testid="reader-appearance-sheet"]')).not.toBeNull();
    expect(panel.querySelector('[data-testid="reader-width-control"]')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    focusable.at(-1)?.focus();
    focusable.at(-1)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await nextTick();
    expect(document.activeElement).toBe(focusable[0]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(wrapper.emitted('close')).toEqual([[]]);

    wrapper.unmount();
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it('keeps reading mode active when Escape closes the appearance panel', async () => {
    const store = mountReadingModeShortcuts();
    await nextTick();
    store.currentArticleId = 42;
    store.setReadingMode(true);
    const wrapper = mountPanel({ mobile: false });

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    await nextTick();

    expect(wrapper.emitted('close')).toEqual([[]]);
    expect(store.isReadingMode).toBe(true);
    expect(store.currentArticleId).toBe(42);
  });

  it('closes a desktop popover when a pointer starts outside its anchor and panel', async () => {
    const wrapper = mountPanel({ mobile: false });

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();

    expect(getPanelElement().getAttribute('aria-modal')).toBeNull();
    expect(wrapper.emitted('close')).toEqual([[]]);
  });
});
