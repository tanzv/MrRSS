import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import CustomThemeManager from './CustomThemeManager.vue';
import type { SettingsData } from '@/types/settings';

const settingsFixture = {
  theme: 'paper',
  theme_profiles: '[]',
  content_font_family: 'serif',
  content_font_size: 22,
  content_line_height: '1.8',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
  ui_font_family: 'system',
  ui_font_size: 16,
} as unknown as SettingsData;

function mountManager(settings = settingsFixture) {
  return mount(CustomThemeManager, {
    props: { settings },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        FontFamilySelect: {
          props: ['modelValue'],
          template:
            '<select data-profile-font :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="system">system</option><option value="serif">serif</option></select>',
        },
        NumberControl: {
          props: ['modelValue'],
          template:
            '<input data-profile-size type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
        },
      },
    },
  });
}

describe('CustomThemeManager', () => {
  it('renders an accessible empty state and creates a profile', async () => {
    const wrapper = mountManager();

    expect(wrapper.get('[data-theme-manager]').exists()).toBe(true);
    expect(wrapper.get('[data-action="new-theme"]').attributes('aria-label')).toBeTruthy();
    await wrapper.get('[data-action="new-theme"]').trigger('click');

    const emitted = wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData;
    expect(JSON.parse(emitted.theme_profiles)).toHaveLength(1);
    expect(emitted.theme.startsWith('custom:')).toBe(true);
  });

  it('updates a token while keeping reader typography untouched', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');
    await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#ff5500');

    const emitted = wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData;
    const profiles = JSON.parse(emitted.theme_profiles);
    expect(profiles[0].light['accent-color']).toBe('#ff5500');
    expect(emitted.content_font_family).toBe(settingsFixture.content_font_family);
    expect(emitted.content_font_size).toBe(settingsFixture.content_font_size);
  });

  it('switches variants, resets one token, duplicates, and deletes profiles', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');
    await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#ff5500');
    await wrapper.get('[data-variant="dark"]').trigger('click');
    await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#00aa88');

    let profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles[0].dark['accent-color']).toBe('#00aa88');
    await wrapper.get('[data-token="accent-color"] [data-action="reset-token"]').trigger('click');
    profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles[0].dark['accent-color']).toBeUndefined();

    await wrapper.get('[data-action="duplicate-theme"]').trigger('click');
    profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles).toHaveLength(2);

    await wrapper.get('[data-action="delete-theme"]').trigger('click');
    profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles).toHaveLength(1);
  });

  it('exposes separate appearance controls and token groups', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');

    expect(wrapper.get('[role="radiogroup"][data-appearance-group]').exists()).toBe(true);
    expect(wrapper.get('[role="tablist"][data-variant-tabs]').exists()).toBe(true);
    expect(wrapper.get('[data-token-group="surface"]').exists()).toBe(true);
    expect(wrapper.get('[data-token-group="reader"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-contrast-status] [role="listitem"]')).toHaveLength(9);
  });

  it('keeps the current profiles when an import document is invalid', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');
    const input = wrapper.get('input[type="file"]');
    const invalidFile = new File(
      [JSON.stringify({ version: 1, profiles: [{ id: 'broken' }] })],
      'broken.json',
      { type: 'application/json' }
    );
    Object.defineProperty(input.element, 'files', { value: [invalidFile] });

    await input.trigger('change');
    await flushPromises();

    const latest = wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData;
    expect(JSON.parse(latest.theme_profiles)).toHaveLength(1);
  });
});
