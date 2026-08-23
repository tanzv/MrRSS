import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import ThemePresetPicker from './ThemePresetPicker.vue';

function mountPicker(modelValue: 'auto' | 'paper' | 'ink' | 'sepia' | 'high-contrast' = 'paper') {
  return mount(ThemePresetPicker, {
    props: { modelValue },
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
});
