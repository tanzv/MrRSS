import { describe, expect, it } from 'vitest';
import {
  getDefaultReaderTypographyPreset,
  getReaderTypographyPreset,
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

  it('recognizes Magazine only when all five of its explicit values match', () => {
    const magazine = readerTypographyPresets.find((preset) => preset.id === 'magazine');

    expect(magazine?.values).toEqual({
      content_font_family: 'serif',
      content_font_size: 17,
      content_line_height: '1.7',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
    });
    expect(getReaderTypographyPreset(magazine?.values ?? {})).toBe('magazine');
    expect(
      getReaderTypographyPreset({
        ...magazine?.values,
        content_font_size: 18,
      })
    ).toBe('custom');
  });

  it('offers only the typography styles that remain meaningful without an app theme', () => {
    expect(readerTypographyPresets.map((preset) => preset.id)).toEqual([
      'focus',
      'magazine',
      'book',
      'compact',
    ]);
  });

  it('restores the complete Focus values without consulting the current app theme', () => {
    expect(getDefaultReaderTypographyPreset().values).toEqual({
      content_font_family: 'system',
      content_font_size: 16,
      content_line_height: '1.6',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
    });
  });

  it('reports Custom after a one-field change from the default preset', () => {
    expect(
      getReaderTypographyPreset({
        ...getDefaultReaderTypographyPreset().values,
        content_font_family: 'PingFang SC',
      })
    ).toBe('custom');
  });
});
