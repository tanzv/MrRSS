import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setSettingsFromRawData, useSettings } from './useSettings';

describe('settings theme profile normalization', () => {
  it('normalizes invalid theme profile JSON before exposing settings', () => {
    setSettingsFromRawData({
      theme: 'custom:missing',
      theme_profiles: '{broken',
      content_font_family: 'serif',
      content_font_size: '22',
    });

    let currentSettings: ReturnType<typeof useSettings>['settings'] | undefined;
    const Probe = defineComponent({
      setup() {
        currentSettings = useSettings().settings;
        return {};
      },
      template: '<div />',
    });
    const wrapper = mount(Probe, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })],
      },
    });
    expect(currentSettings?.value.theme_profiles).toBe('[]');
    expect(currentSettings?.value.theme).toBe('custom:missing');
    expect(currentSettings?.value.content_font_family).toBe('serif');
    expect(currentSettings?.value.content_font_size).toBe(22);
    wrapper.unmount();
  });

  it('falls back to an empty profile list when serialized data exceeds the limit', () => {
    expect(() =>
      setSettingsFromRawData({
        theme_profiles: JSON.stringify([
          {
            id: 'large',
            name: 'x'.repeat(48),
            light: { 'accent-color': '#ffffff' },
            dark: {},
            uiFontFamily: 'system',
            uiFontSize: 16,
            padding: 'x'.repeat(512 * 1024),
          },
        ]),
      })
    ).not.toThrow();
  });
});
