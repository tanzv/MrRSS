import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import type { SettingsData } from '@/types/settings';
import en from '@/i18n/locales/en';
import ShortcutsTab from './ShortcutsTab.vue';

vi.mock('@/composables/core/useSettingsAutoSave', () => ({
  useSettingsAutoSave: vi.fn(),
}));

const ShortcutItemStub = defineComponent({
  props: {
    item: { type: Object, required: true },
    shortcutValue: { type: String, required: true },
  },
  template: '<div :data-testid="`shortcut-${item.key}`">{{ item.label }} {{ shortcutValue }}</div>',
});

let wrapper: VueWrapper | undefined;

describe('ShortcutsTab reading mode', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('lists M as the configurable reading-mode shortcut', () => {
    wrapper = mount(ShortcutsTab, {
      props: {
        settings: { shortcuts: '', shortcuts_enabled: true } as SettingsData,
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: {
          ShortcutItem: ShortcutItemStub,
          ButtonControl: true,
          SettingWithToggle: true,
          TipBox: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="shortcut-toggleReadingMode"]').text()).toContain(
      'Toggle reading mode'
    );
    expect(wrapper.get('[data-testid="shortcut-toggleReadingMode"]').text()).toContain('m');
  });
});
