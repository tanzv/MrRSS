import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingWithToggle from './SettingWithToggle.vue';

describe('SettingWithToggle', () => {
  it('names its native checkbox from the setting title', () => {
    const wrapper = mount(SettingWithToggle, {
      props: {
        title: 'Refresh feeds automatically',
        modelValue: true,
      },
    });

    expect(wrapper.get('input[type="checkbox"]').attributes('aria-label')).toBe(
      'Refresh feeds automatically'
    );
  });
});
