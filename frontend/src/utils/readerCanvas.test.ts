import { describe, expect, it } from 'vitest';
import {
  calculateReaderCanvasContrast,
  normalizeReaderCanvas,
  readerCanvasContrastPasses,
  resolveReaderCanvas,
} from './readerCanvas';

describe('reader canvas', () => {
  it('keeps only a complete lowercase opaque custom color pair', () => {
    expect(
      normalizeReaderCanvas({
        content_background_color: ' #F7F1E3 ',
        content_text_color: '#352C24',
      })
    ).toEqual({
      content_background_color: '#f7f1e3',
      content_text_color: '#352c24',
    });
  });

  it('falls back to theme mode for partial, transparent, malformed, or low-contrast values', () => {
    for (const input of [
      { content_background_color: '#ffffff', content_text_color: '' },
      { content_background_color: '#ffffff00', content_text_color: '#000000' },
      { content_background_color: 'white', content_text_color: '#000000' },
      { content_background_color: '#ffffff', content_text_color: '#eeeeee' },
    ]) {
      expect(normalizeReaderCanvas(input)).toEqual({
        content_background_color: '',
        content_text_color: '',
      });
    }
  });

  it('exposes local variables only for a valid custom canvas', () => {
    const canvas = resolveReaderCanvas({
      content_background_color: '#111111',
      content_text_color: '#ffffff',
    });

    expect(canvas.mode).toBe('custom');
    expect(canvas.cssVariables).toMatchObject({
      '--reader-canvas-background': '#111111',
      '--reader-canvas-text': '#ffffff',
    });
    expect(calculateReaderCanvasContrast('#000000', '#666666')).toBeLessThan(4.5);
    expect(readerCanvasContrastPasses('#111111', '#ffffff')).toBe(true);
  });
});
