import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import AdvancedSettings from './AdvancedSettings.vue';

function mountAdvancedSettings(
  overrides: Partial<InstanceType<typeof AdvancedSettings>['$props']> = {}
) {
  return mount(AdvancedSettings, {
    props: {
      imageGalleryEnabled: false,
      isImageMode: false,
      hideFromTimeline: false,
      articleViewMode: 'rendered',
      autoReadingMode: false,
      autoExpandContent: 'global',
      proxyMode: 'global',
      proxyType: 'http',
      proxyHost: '',
      proxyPort: '',
      proxyUsername: '',
      proxyPassword: '',
      refreshMode: 'global',
      refreshInterval: 0,
      ...overrides,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

describe('AdvancedSettings automatic reader preference', () => {
  it('emits the selected automatic reader preference for an in-app view', async () => {
    const wrapper = mountAdvancedSettings();

    await wrapper.get('[data-testid="auto-reading-mode"]').setValue(true);

    expect(wrapper.emitted('update:autoReadingMode')).toEqual([[true]]);
  });

  it('retains automatic reading but disables its control for external viewing', () => {
    const wrapper = mountAdvancedSettings({
      articleViewMode: 'external',
      autoReadingMode: true,
    });

    const input = wrapper.get('[data-testid="auto-reading-mode"]');
    expect((input.element as HTMLInputElement).checked).toBe(true);
    expect(input.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('External browser view takes priority');
  });
});
