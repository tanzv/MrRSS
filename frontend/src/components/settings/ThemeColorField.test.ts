import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ThemeColorField from './ThemeColorField.vue';

describe('ThemeColorField', () => {
  it('restores the saved value when its parent rejects a color update', async () => {
    const wrapper = mount(ThemeColorField, {
      props: {
        modelValue: undefined,
        label: 'Accent foreground',
        resetVersion: 0,
      },
    });
    const input = wrapper.get('input[type="text"]');

    await input.setValue('#ffffff');
    await wrapper.setProps({ resetVersion: 1 });

    expect((input.element as HTMLInputElement).value).toBe('');
  });
});
