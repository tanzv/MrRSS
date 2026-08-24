import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { generateInitialSettings } from '@/composables/core/useSettings.generated';
import en from '@/i18n/locales/en';
import type { CustomThemeProfile } from '@/types/theme';
import ApplicationSettings from './ApplicationSettings.vue';

const focusProfile: CustomThemeProfile = {
  id: 'focus',
  name: 'Focus',
  basePreset: 'paper',
  appearance: 'light',
  light: {},
  dark: {},
  uiFontFamily: 'system',
  uiFontSize: 16,
  updatedAt: '2026-08-23T00:00:00.000Z',
};

function mountSettings() {
  const settings = generateInitialSettings();
  settings.theme = 'custom:focus';
  settings.theme_profiles = JSON.stringify([focusProfile]);

  return mount(ApplicationSettings, {
    props: { settings },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        SettingGroup: { template: '<section><slot /></section>' },
        SettingItem: { template: '<div><slot /></div>' },
        SettingWithToggle: true,
        SettingWithSelect: true,
        NumberControl: true,
        FontFamilySelect: true,
        CustomThemeManager: true,
      },
    },
  });
}

describe('ApplicationSettings theme picker', () => {
  it('provides saved custom profiles to the accessible theme radio group', () => {
    const wrapper = mountSettings();

    expect(wrapper.get('[data-theme-option="custom:focus"]').attributes('aria-checked')).toBe(
      'true'
    );
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
  });
});
