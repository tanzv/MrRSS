import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import ReaderCanvasColorControls from './ReaderCanvasColorControls.vue';

function mountControls(canvas: {
  content_background_color: string;
  content_text_color: string;
}) {
  return mount(ReaderCanvasColorControls, {
    props: { canvas },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

afterEach(() => {
  document.documentElement.style.removeProperty('--bg-primary');
  document.documentElement.style.removeProperty('--text-primary');
});

describe('ReaderCanvasColorControls', () => {
  it('seeds a valid pair on custom mode and clears both fields on theme mode', async () => {
    document.documentElement.style.setProperty('--bg-primary', '#f7f1e3');
    document.documentElement.style.setProperty('--text-primary', '#352c24');
    const wrapper = mountControls({ content_background_color: '', content_text_color: '' });

    await wrapper.get('[data-testid="reader-canvas-mode-custom"]').trigger('click');
    expect(wrapper.emitted('update:canvas')?.at(-1)).toEqual([
      { content_background_color: '#f7f1e3', content_text_color: '#352c24' },
    ]);

    await wrapper.get('[data-testid="reader-canvas-mode-theme"]').trigger('click');
    expect(wrapper.emitted('update:canvas')?.at(-1)).toEqual([
      { content_background_color: '', content_text_color: '' },
    ]);
  });

  it('keeps a low-contrast draft local and exposes an accessible warning', async () => {
    const wrapper = mountControls({
      content_background_color: '#ffffff',
      content_text_color: '#111111',
    });

    await wrapper.get('[data-testid="reader-canvas-text-input"]').setValue('#eeeeee');

    expect(wrapper.emitted('update:canvas')).toBeUndefined();
    expect(wrapper.get('[data-testid="reader-canvas-contrast"]').attributes('aria-invalid')).toBe(
      'true'
    );
    expect(wrapper.text()).toContain('Choose colors with at least 4.5:1 contrast');
  });
});
