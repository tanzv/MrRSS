import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
import ArticleBody from './ArticleBody.vue';

let wrapper: VueWrapper | undefined;

describe('ArticleBody typography', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    setSettingsFromRawData({});
    vi.unstubAllGlobals();
  });

  it('applies the resolved reader font, size, line height, and paragraph variables', async () => {
    const rawSettings = {
      content_font_family: 'serif',
      content_font_size: '18',
      content_line_height: '1.8',
      content_width: 'narrow',
      content_paragraph_spacing: 'relaxed',
    };
    setSettingsFromRawData(rawSettings);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(rawSettings),
      })
    );

    wrapper = mount(ArticleBody, {
      props: {
        articleContent: '<p>Body</p>',
        isTranslatingContent: false,
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    await flushPromises();

    const prose = wrapper.get('.prose-content');
    expect(prose.attributes('style')).toContain('--reader-font-size: 18px');
    expect(prose.attributes('style')).toContain('--reader-line-height: 1.8');
    expect(prose.attributes('style')).toContain('--reader-paragraph-gap: 1.6em');
    expect(prose.attributes('style')).toContain('font-family: var(--reader-font-family)');
  });
});
