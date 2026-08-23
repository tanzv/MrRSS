import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import { resolveReaderTypography } from '@/utils/readerTypography';
import ReaderTypographyPreview from './ReaderTypographyPreview.vue';

describe('ReaderTypographyPreview', () => {
  it('exposes the resolved reader variables and layout semantics', () => {
    const wrapper = mount(ReaderTypographyPreview, {
      props: {
        typography: resolveReaderTypography({
          content_font_family: 'serif',
          content_font_size: 18,
          content_line_height: '1.8',
          content_width: 'narrow',
          content_paragraph_spacing: 'relaxed',
        }),
        themePreset: 'sepia',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });

    const preview = wrapper.get('[data-testid="reader-typography-preview"]');
    expect(preview.attributes('role')).toBe('region');
    expect(preview.attributes('aria-label')).toBe('Reading Preview');
    expect(preview.attributes('data-reader-width')).toBe('narrow');
    expect(preview.attributes('data-paragraph-spacing')).toBe('relaxed');
    expect(preview.attributes('data-reader-theme')).toBe('sepia');
    expect(preview.attributes('style')).toContain('--reader-font-size: 18px');
    expect(preview.get('h3').text()).toBe('A measured reading rhythm');
    expect(preview.findAll('p')).toHaveLength(2);
  });
});
