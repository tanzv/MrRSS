import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import PanelResizeHandle from './PanelResizeHandle.vue';

function mountHandle(modelValue = 280) {
  return mount(PanelResizeHandle, {
    props: {
      modelValue,
      min: 240,
      max: 420,
      defaultValue: 280,
      label: 'Resize subscription sources',
    },
  });
}

afterEach(() => {
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

describe('PanelResizeHandle', () => {
  it('exposes a vertical separator and adjusts its controlled value from the keyboard', async () => {
    const wrapper = mountHandle();
    const handle = wrapper.get('[role="separator"]');

    expect(handle.attributes('aria-orientation')).toBe('vertical');
    expect(handle.attributes('aria-valuemin')).toBe('240');
    expect(handle.attributes('aria-valuemax')).toBe('420');
    expect(handle.attributes('aria-valuenow')).toBe('280');
    expect(handle.attributes('aria-label')).toBe('Resize subscription sources');

    await handle.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')).toEqual([[296]]);

    await wrapper.setProps({ modelValue: 296 });
    await handle.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
    expect(wrapper.emitted('update:modelValue')).toEqual([[296], [344]]);

    await wrapper.setProps({ modelValue: 344 });
    await handle.trigger('keydown', { key: 'Home' });
    await handle.trigger('keydown', { key: 'End' });
    expect(wrapper.emitted('update:modelValue')).toEqual([[296], [344], [240], [420]]);
  });

  it('captures a pointer drag and restores document interaction state after cancellation', () => {
    const wrapper = mountHandle();
    const handle = wrapper.get('[role="separator"]');
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(handle.element, 'setPointerCapture', { value: setPointerCapture });
    Object.defineProperty(handle.element, 'releasePointerCapture', {
      value: releasePointerCapture,
    });
    document.body.style.cursor = 'wait';
    document.body.style.userSelect = 'text';

    handle.element.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, pointerId: 7 })
    );
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    handle.element.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 150, pointerId: 7 })
    );
    expect(wrapper.emitted('update:modelValue')).toEqual([[330]]);

    handle.element.dispatchEvent(
      new PointerEvent('pointercancel', { bubbles: true, clientX: 150, pointerId: 7 })
    );
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(document.body.style.cursor).toBe('wait');
    expect(document.body.style.userSelect).toBe('text');

    wrapper.unmount();
  });

  it('restores the supplied default width after a double click', async () => {
    const wrapper = mountHandle(376);

    await wrapper.get('[role="separator"]').trigger('dblclick');

    expect(wrapper.emitted('update:modelValue')).toEqual([[280]]);
  });

  it('restores document interaction state when unmounted during an active drag', () => {
    const wrapper = mountHandle();
    const handle = wrapper.get('[role="separator"]');
    const releasePointerCapture = vi.fn();
    Object.defineProperty(handle.element, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(handle.element, 'releasePointerCapture', {
      value: releasePointerCapture,
    });
    document.body.style.cursor = 'wait';
    document.body.style.userSelect = 'text';

    handle.element.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, pointerId: 9 })
    );
    wrapper.unmount();

    expect(releasePointerCapture).toHaveBeenCalledWith(9);
    expect(document.body.style.cursor).toBe('wait');
    expect(document.body.style.userSelect).toBe('text');
  });
});
