import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import ArticleChatButton from './ArticleChatButton.vue';

describe('ArticleChatButton', () => {
  it('uses the active theme foreground for its accent action', () => {
    const wrapper = mount(ArticleChatButton, {
      props: { onClick: () => undefined },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    expect(wrapper.get('button').classes()).toContain('on-accent');
  });
});
