import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ModalFooter from './ModalFooter.vue';

describe('ModalFooter', () => {
  it('uses the shared button sizes for secondary, danger, and primary actions', () => {
    const wrapper = mount(ModalFooter, {
      props: {
        secondaryButton: { label: 'Cancel' },
        dangerButton: { label: 'Delete' },
        primaryButton: { label: 'Save' },
      },
    });

    const [secondary, danger, primary] = wrapper.findAll('button');
    expect(secondary.classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--secondary'])
    );
    expect(danger.classes()).toEqual(expect.arrayContaining(['ui-button', 'ui-button--danger']));
    expect(primary.classes()).toEqual(expect.arrayContaining(['ui-button', 'ui-button--primary']));
  });
});
