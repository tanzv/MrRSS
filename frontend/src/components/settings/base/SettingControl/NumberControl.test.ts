import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NumberControl from './NumberControl.vue';

describe('NumberControl', () => {
  it('applies its accessible label to the native number input', () => {
    const wrapper = mount(NumberControl, {
      props: {
        modelValue: 16,
        ariaLabel: 'Interface font size',
      },
    });

    expect(wrapper.get('input[type="number"]').attributes('aria-label')).toBe(
      'Interface font size'
    );
  });
});
