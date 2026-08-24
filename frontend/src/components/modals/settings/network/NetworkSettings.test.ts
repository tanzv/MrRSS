import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import NetworkSettings from './NetworkSettings.vue';

function mountSettings() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

  return mount(NetworkSettings, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        SettingGroup: { template: '<section><slot /></section>' },
        TipBox: true,
        StatusBoxGroup: {
          props: ['actionButton'],
          template: '<button data-detect-network @click="actionButton.onClick()">Detect</button>',
        },
      },
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NetworkSettings', () => {
  it('renders failed detection feedback with the theme danger surface', async () => {
    const wrapper = mountSettings();

    await wrapper.get('[data-detect-network]').trigger('click');
    await flushPromises();

    const feedback = wrapper.find('.state-danger-surface');
    expect(feedback.exists()).toBe(true);
    if (!feedback.exists()) return;
    expect(feedback.text()).toBe('Network detection failed');
  });
});
