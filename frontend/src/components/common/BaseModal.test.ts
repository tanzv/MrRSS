import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import BaseModal from './BaseModal.vue';

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe('BaseModal', () => {
  it('uses the shared modal header geometry and close control', () => {
    wrapper = mount(BaseModal, {
      props: { title: 'Settings' },
    });

    expect(wrapper.get('.app-modal-header').exists()).toBe(true);
    expect(wrapper.get('h3').classes()).toContain('ui-modal-title');
    expect(wrapper.get('button').classes()).toContain('ui-icon-button');
  });
});
