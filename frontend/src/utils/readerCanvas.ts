export interface ReaderCanvasInput {
  content_background_color?: unknown;
  content_text_color?: unknown;
}

export interface ReaderCanvasValues {
  content_background_color: string;
  content_text_color: string;
}

export interface ReaderCanvas {
  mode: 'theme' | 'custom';
  values: ReaderCanvasValues;
  contrastRatio: number | null;
  cssVariables: Record<'--reader-canvas-background' | '--reader-canvas-text', string>;
}

const MINIMUM_TEXT_CONTRAST = 4.5;
const hexColorPattern = /^#[0-9a-f]{6}$/i;

const themeCanvasValues: ReaderCanvasValues = {
  content_background_color: '',
  content_text_color: '',
};

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  return hexColorPattern.test(normalized) ? normalized : null;
}

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function calculateReaderCanvasContrast(background: string, text: string): number {
  const normalizedBackground = normalizeHexColor(background);
  const normalizedText = normalizeHexColor(text);
  if (!normalizedBackground || !normalizedText) return Number.NaN;

  const backgroundLuminance = relativeLuminance(normalizedBackground);
  const textLuminance = relativeLuminance(normalizedText);
  const lighter = Math.max(backgroundLuminance, textLuminance);
  const darker = Math.min(backgroundLuminance, textLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function readerCanvasContrastPasses(background: string, text: string): boolean {
  return calculateReaderCanvasContrast(background, text) >= MINIMUM_TEXT_CONTRAST;
}

export function normalizeReaderCanvas(input: ReaderCanvasInput): ReaderCanvasValues {
  const background = normalizeHexColor(input.content_background_color);
  const text = normalizeHexColor(input.content_text_color);

  if (!background || !text || !readerCanvasContrastPasses(background, text)) {
    return { ...themeCanvasValues };
  }

  return {
    content_background_color: background,
    content_text_color: text,
  };
}

export function resolveReaderCanvas(input: ReaderCanvasInput): ReaderCanvas {
  const values = normalizeReaderCanvas(input);
  if (!values.content_background_color) {
    return {
      mode: 'theme',
      values,
      contrastRatio: null,
      cssVariables: {},
    };
  }

  return {
    mode: 'custom',
    values,
    contrastRatio: calculateReaderCanvasContrast(
      values.content_background_color,
      values.content_text_color
    ),
    cssVariables: {
      '--reader-canvas-background': values.content_background_color,
      '--reader-canvas-text': values.content_text_color,
    },
  };
}
