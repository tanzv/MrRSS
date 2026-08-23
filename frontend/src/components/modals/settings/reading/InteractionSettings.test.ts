import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { SettingsData } from '@/types/settings';
import { generateInitialSettings } from '@/composables/core/useSettings.generated';
import en from '@/i18n/locales/en';
import InteractionSettings from './InteractionSettings.vue';

describe('InteractionSettings scroll read preference', () => {
  it('updates only the scroll read preference', async () => {
    const settings = generateInitialSettings();
    const wrapper = mount(InteractionSettings, {
      props: { settings },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    await wrapper.get('input[aria-label="Mark as Read on Scroll"]').setValue(true);

    const updated = wrapper.emitted('update:settings')?.[0]?.[0] as SettingsData & {
      mark_read_on_scroll: boolean;
    };
    expect(updated.mark_read_on_scroll).toBe(true);
    expect(updated.hover_mark_as_read).toBe(settings.hover_mark_as_read);
    expect(updated.show_hidden_articles).toBe(settings.show_hidden_articles);
  });
});
