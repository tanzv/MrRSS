import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { SettingsData } from '@/types/settings';
import { generateInitialSettings } from '@/composables/core/useSettings.generated';
import SettingWithSelect from '@/components/settings/composite/SettingWithSelect.vue';
import ReaderCanvasColorControls from '@/components/settings/ReaderCanvasColorControls.vue';
import en from '@/i18n/locales/en';
import TypographySettings from './TypographySettings.vue';

type ReaderLayoutSettings = SettingsData & {
  content_width: 'narrow' | 'comfortable' | 'wide';
  content_paragraph_spacing: 'compact' | 'comfortable' | 'relaxed';
};

function createSettings(): ReaderLayoutSettings {
  return {
    ...generateInitialSettings(),
    content_width: 'comfortable',
    content_paragraph_spacing: 'comfortable',
  } as ReaderLayoutSettings;
}

function findSelectByOption(
  wrapper: ReturnType<typeof mount>,
  optionValue: string
): ReturnType<typeof mount> {
  const select = wrapper.findAllComponents(SettingWithSelect).find((component) => {
    const options = component.props('options') as Array<{ value: string | number }>;
    return options.some((option) => option.value === optionValue);
  });

  if (!select) {
    throw new Error(`Expected a select control with the ${optionValue} option`);
  }

  return select;
}

describe('TypographySettings reader layout controls', () => {
  it('applies a reader preset as five explicit typography fields', async () => {
    const wrapper = mount(TypographySettings, {
      props: { settings: createSettings() },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    await wrapper.get('[data-reader-preset="book"]').trigger('click');

    const updated = wrapper.emitted('update:settings')?.[0]?.[0] as ReaderLayoutSettings;
    expect(updated).toMatchObject({
      content_font_family: 'serif',
      content_font_size: 18,
      content_line_height: '1.8',
      content_width: 'narrow',
      content_paragraph_spacing: 'relaxed',
    });
    expect(wrapper.get('[data-testid="reader-typography-preview"]').exists()).toBe(true);
  });

  it('writes the complete Magazine values through the existing settings update event', async () => {
    const wrapper = mount(TypographySettings, {
      props: { settings: createSettings() },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    await wrapper.get('[data-reader-preset="magazine"]').trigger('click');

    expect(wrapper.emitted('update:settings')?.[0]?.[0]).toMatchObject({
      content_font_family: 'serif',
      content_font_size: 17,
      content_line_height: '1.7',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
    });
  });

  it('updates width without changing the existing font settings', async () => {
    const settings = createSettings();
    const wrapper = mount(TypographySettings, {
      props: { settings },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    findSelectByOption(wrapper, 'wide').vm.$emit('update:modelValue', 'wide');

    const updated = wrapper.emitted('update:settings')?.[0]?.[0] as ReaderLayoutSettings;
    expect(updated.content_width).toBe('wide');
    expect(updated.content_font_family).toBe(settings.content_font_family);
    expect(updated.content_font_size).toBe(settings.content_font_size);
    expect(updated.content_line_height).toBe(settings.content_line_height);
  });

  it('updates paragraph spacing independently of width', async () => {
    const settings = createSettings();
    const wrapper = mount(TypographySettings, {
      props: { settings },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    findSelectByOption(wrapper, 'relaxed').vm.$emit('update:modelValue', 'relaxed');

    const updated = wrapper.emitted('update:settings')?.[0]?.[0] as ReaderLayoutSettings;
    expect(updated.content_paragraph_spacing).toBe('relaxed');
    expect(updated.content_width).toBe('comfortable');
  });

  it('writes a complete canvas pair through the existing settings update event', () => {
    const settings = createSettings();
    const wrapper = mount(TypographySettings, {
      props: { settings },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    wrapper.findComponent(ReaderCanvasColorControls).vm.$emit('update:canvas', {
      content_background_color: '#111111',
      content_text_color: '#ffffff',
    });

    expect(wrapper.emitted('update:settings')?.at(-1)?.[0]).toMatchObject({
      content_background_color: '#111111',
      content_text_color: '#ffffff',
      content_font_family: settings.content_font_family,
      content_font_size: settings.content_font_size,
      content_line_height: settings.content_line_height,
      content_width: settings.content_width,
      content_paragraph_spacing: settings.content_paragraph_spacing,
    });
  });
});
