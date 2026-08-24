import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import type { CustomThemeProfile } from '@/types/theme';
import ThemePresetPicker from './ThemePresetPicker.vue';

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

function mountPicker(modelValue = 'paper', profiles: CustomThemeProfile[] = []) {
  return mount(ThemePresetPicker, {
    props: { modelValue, profiles },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en },
        }),
      ],
    },
  });
}

describe('ThemePresetPicker', () => {
  it('renders all built-in choices with accessible selected state', () => {
    const wrapper = mountPicker();

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Theme');
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(5);
    expect(wrapper.get('[data-theme-option="paper"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[data-theme-option="paper"]').attributes('tabindex')).toBe('0');
    expect(wrapper.get('[data-theme-option="ink"]').attributes('aria-checked')).toBe('false');
    expect(wrapper.get('[data-theme-option="ink"]').attributes('tabindex')).toBe('-1');
  });

  it('emits the chosen built-in preset', async () => {
    const wrapper = mountPicker();

    await wrapper.get('[data-theme-option="sepia"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['sepia']]);
  });

  it('supports radio-group arrow-key navigation', async () => {
    const wrapper = mountPicker('paper');

    await wrapper.get('[data-theme-option="paper"]').trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['ink']]);
  });

  it('keeps an active custom profile inside the radio group and wraps keyboard navigation', async () => {
    const wrapper = mountPicker('custom:focus', [focusProfile]);
    const customOption = wrapper.find('[data-theme-option="custom:focus"]');

    expect(wrapper.findAll('[role="radio"]')).toHaveLength(6);
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
    expect(customOption.exists()).toBe(true);
    if (!customOption.exists()) return;
    expect(customOption.attributes('tabindex')).toBe('0');

    await customOption.trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['auto']]);
  });

  it('falls back to Auto when the persisted custom profile no longer exists', () => {
    const wrapper = mountPicker('custom:missing', [focusProfile]);

    expect(wrapper.get('[data-theme-option="auto"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
  });
});
