import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import en from '@/i18n/locales/en';
import { useAppStore } from './app';

let wrapper: VueWrapper | undefined;

function mountStore(): ReturnType<typeof useAppStore> {
  let store: ReturnType<typeof useAppStore> | undefined;

  wrapper = mount(
    defineComponent({
      setup() {
        store = useAppStore();
        return () => h('div');
      },
    }),
    {
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    }
  );

  return store!;
}

describe('app reading mode state', () => {
  beforeEach(() => {
    localStorage.removeItem('isReadingMode');
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('is session-only and can be explicitly entered and exited', () => {
    const store = mountStore();

    expect(store.isReadingMode).toBe(false);

    store.setReadingMode(true);
    expect(store.isReadingMode).toBe(true);
    expect(localStorage.getItem('isReadingMode')).toBeNull();

    store.setReadingMode(false);
    expect(store.isReadingMode).toBe(false);
  });
});
