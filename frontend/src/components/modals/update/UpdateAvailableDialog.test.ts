import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import UpdateAvailableDialog from './UpdateAvailableDialog.vue';

describe('UpdateAvailableDialog repository links', () => {
  it('links manual downloads to the current repository latest release', () => {
    const wrapper = mount(UpdateAvailableDialog, {
      props: {
        updateInfo: {
          has_update: true,
          current_version: '1.3.25',
          latest_version: '1.3.26',
        },
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          BaseModal: {
            template: '<section><slot name="header" /><slot /><slot name="footer" /></section>',
          },
          ModalFooter: {
            template: '<footer><slot name="right" /></footer>',
          },
        },
      },
    });

    expect(wrapper.get('[data-testid="manual-update-link"]').attributes('href')).toBe(
      'https://github.com/tanzv/MrRSS/releases/latest'
    );
  });
});
