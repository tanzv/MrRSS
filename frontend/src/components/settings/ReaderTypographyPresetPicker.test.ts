import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { ThemePreset } from '@/utils/theme';
import en from '@/i18n/locales/en';
import ReaderTypographyPresetPicker from './ReaderTypographyPresetPicker.vue';

const focusSettings = {
  content_font_family: 'system',
  content_font_size: 16,
  content_line_height: '1.6',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
};

function mountPicker(
  settings = focusSettings,
  themePreset: ThemePreset = 'paper',
  extraProps: { variant?: 'settings' | 'compact' } = {}
) {
  return mount(ReaderTypographyPresetPicker, {
    props: { settings, themePreset, ...extraProps },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

describe('ReaderTypographyPresetPicker', () => {
  it('exposes the matched preset as an accessible radio choice', () => {
    const wrapper = mountPicker();

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Reading Style');
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(6);
    expect(wrapper.get('[data-reader-preset="focus"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[data-reader-preset="book"]').attributes('aria-checked')).toBe('false');
  });

  it('emits all explicit Book values from its command', async () => {
    const wrapper = mountPicker();

    await wrapper.get('[data-reader-preset="book"]').trigger('click');

    expect(wrapper.emitted('select')).toEqual([
      [
        {
          content_font_family: 'serif',
          content_font_size: 18,
          content_line_height: '1.8',
          content_width: 'narrow',
          content_paragraph_spacing: 'relaxed',
        },
      ],
    ]);
  });

  it('emits all explicit Magazine values from its command', async () => {
    const wrapper = mountPicker();

    await wrapper.get('[data-reader-preset="magazine"]').trigger('click');

    expect(wrapper.emitted('select')).toEqual([
      [
        {
          content_font_family: 'serif',
          content_font_size: 17,
          content_line_height: '1.7',
          content_width: 'comfortable',
          content_paragraph_spacing: 'comfortable',
        },
      ],
    ]);
  });

  it('reports Custom after any individual setting no longer matches a preset', () => {
    const wrapper = mountPicker({ ...focusSettings, content_width: 'wide' });

    expect(wrapper.get('[data-testid="reader-preset-custom"]').text()).toBe('Custom');
    expect(wrapper.get('[data-reader-preset="focus"]').attributes('aria-checked')).toBe('false');
  });

  it('marks the Ink recommendation without changing the selected typography', () => {
    const wrapper = mountPicker(focusSettings, 'ink');
    const night = wrapper.get('[data-reader-preset="night"]');

    expect(night.attributes('data-reader-style-theme')).toBe('ink');
    expect(night.attributes('data-reader-theme-recommendation')).toBe('true');
    expect(night.attributes('aria-label')).toBe('Night, Ink theme style, recommended');
    expect(wrapper.get('[data-reader-preset="focus"]').attributes('aria-checked')).toBe('true');
  });

  it('emits all explicit Night values from its Ink-related command', async () => {
    const wrapper = mountPicker(focusSettings, 'ink');

    await wrapper.get('[data-reader-preset="night"]').trigger('click');

    expect(wrapper.emitted('select')).toEqual([
      [
        {
          content_font_family: 'system',
          content_font_size: 17,
          content_line_height: '1.7',
          content_width: 'comfortable',
          content_paragraph_spacing: 'relaxed',
        },
      ],
    ]);
  });

  it('renders the shared radio group in compact mode without losing selection semantics', () => {
    const wrapper = mountPicker(focusSettings, 'paper', { variant: 'compact' });

    expect(wrapper.get('[role="radiogroup"]').classes()).toContain(
      'reader-typography-preset-picker--compact'
    );
    expect(wrapper.get('[data-reader-preset="focus"]').attributes('aria-checked')).toBe('true');
  });
});
