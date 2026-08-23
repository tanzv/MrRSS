import { describe, expect, it } from 'vitest';
import {
  getReaderTypographyPreset,
  getRecommendedReaderTypographyPreset,
  readerTypographyPresets,
  resolveReaderTypography,
} from './readerTypography';

describe('reader typography', () => {
  it('normalizes unknown values to reader defaults', () => {
    expect(
      resolveReaderTypography({
        content_font_family: '',
        content_font_size: 99,
        content_line_height: 'bad',
        content_width: 'edge-to-edge',
        content_paragraph_spacing: 'extra',
      })
    ).toMatchObject({
      fontFamily: 'system',
      fontSize: 16,
      lineHeight: 1.6,
      width: 'comfortable',
      paragraphSpacing: 'comfortable',
    });
  });

  it('maps normalized values to safe CSS variables', () => {
    const typography = resolveReaderTypography({
      content_font_family: 'serif',
      content_font_size: 18,
      content_line_height: '1.8',
      content_width: 'narrow',
      content_paragraph_spacing: 'relaxed',
    });

    expect(typography.cssVariables).toMatchObject({
      '--reader-font-family': 'Georgia, "Times New Roman", Times, serif',
      '--reader-font-size': '18px',
      '--reader-line-height': '1.8',
      '--reader-paragraph-gap': '1.6em',
    });
    expect(typography.width).toBe('narrow');
    expect(typography.paragraphSpacing).toBe('relaxed');
  });

  it('recognizes a preset only when all five explicit values match', () => {
    const book = readerTypographyPresets.find((preset) => preset.id === 'book');
    expect(book).toBeDefined();
    expect(book?.values).toEqual({
      content_font_family: 'serif',
      content_font_size: 18,
      content_line_height: '1.8',
      content_width: 'narrow',
      content_paragraph_spacing: 'relaxed',
    });
    expect(getReaderTypographyPreset(book?.values ?? {})).toBe('book');
    expect(
      getReaderTypographyPreset({
        ...book?.values,
        content_width: 'wide',
      })
    ).toBe('custom');
  });

  it('maps each resolved application theme to its recommended reader style', () => {
    expect(getRecommendedReaderTypographyPreset('paper').id).toBe('focus');
    expect(getRecommendedReaderTypographyPreset('ink').id).toBe('night');
    expect(getRecommendedReaderTypographyPreset('sepia').id).toBe('book');
    expect(getRecommendedReaderTypographyPreset('high-contrast').id).toBe('clarity');
    expect(getRecommendedReaderTypographyPreset('unknown').id).toBe('focus');
  });

  it('recognizes the complete Night and Clarity typography values', () => {
    expect(
      getReaderTypographyPreset({
        content_font_family: 'system',
        content_font_size: 17,
        content_line_height: '1.7',
        content_width: 'comfortable',
        content_paragraph_spacing: 'relaxed',
      })
    ).toBe('night');
    expect(
      getReaderTypographyPreset({
        content_font_family: 'system',
        content_font_size: 18,
        content_line_height: '1.8',
        content_width: 'comfortable',
        content_paragraph_spacing: 'relaxed',
      })
    ).toBe('clarity');
  });
});
