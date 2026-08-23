import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { generateInitialSettings } from '@/composables/core/useSettings.generated';
import en from '@/i18n/locales/en';
import CustomizationSettings from './CustomizationSettings.vue';

vi.mock('@/composables/core/useSettings', () => ({
  useSettings: () => ({ fetchSettings: vi.fn() }),
}));

function mountSettings(customCssFile = '') {
  const settings = generateInitialSettings();
  settings.custom_css_file = customCssFile;

  return mount(CustomizationSettings, {
    props: { settings },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

describe('CustomizationSettings mobile actions', () => {
  it('names the icon-only upload action for assistive technology', () => {
    const wrapper = mountSettings();
    const upload = wrapper.get('button.btn-secondary');

    expect(upload.attributes('aria-label')).toBe('Upload CSS');
    expect(upload.attributes('title')).toBe('Upload CSS');
  });

  it('names the icon-only delete action for assistive technology', () => {
    const wrapper = mountSettings('reader.css');
    const remove = wrapper.get('button.btn-danger');

    expect(remove.attributes('aria-label')).toBe('Delete CSS');
    expect(remove.attributes('title')).toBe('Delete CSS');
  });
});
