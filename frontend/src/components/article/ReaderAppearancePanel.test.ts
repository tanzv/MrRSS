import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import FontFamilySelect from '@/components/settings/FontFamilySelect.vue';
import type { ThemePreset } from '@/utils/theme';
import type { ReaderTypographyInput } from '@/utils/readerTypography';
import en from '@/i18n/locales/en';
import ReaderAppearancePanel from './ReaderAppearancePanel.vue';

const focusSettings: ReaderTypographyInput = {
  content_font_family: 'system',
  content_font_size: 16,
  content_line_height: '1.6',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
};

const mountedPanels: Array<VueWrapper<InstanceType<typeof ReaderAppearancePanel>>> = [];
const mountedAnchors: HTMLElement[] = [];

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
  themePreset?: ThemePreset;
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
      themePreset: options.themePreset ?? 'paper',
      saveError: options.saveError ?? false,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
  mountedPanels.push(wrapper);

  return wrapper;
}

afterEach(() => {
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

  it('forwards a font-family selection as a typography patch', () => {
    const wrapper = mountPanel({ mobile: false });

    wrapper.findComponent(FontFamilySelect).vm.$emit('update:modelValue', 'serif');

    expect(wrapper.emitted('update-typography')).toEqual([[{ content_font_family: 'serif' }]]);
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

    expect(max.emitted('restore-theme-recommendation')).toEqual([[]]);
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

  it('closes a desktop popover when a pointer starts outside its anchor and panel', async () => {
    const wrapper = mountPanel({ mobile: false });

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();

    expect(getPanelElement().getAttribute('aria-modal')).toBeNull();
    expect(wrapper.emitted('close')).toEqual([[]]);
  });
});
