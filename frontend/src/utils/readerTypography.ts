import { resolveFontFamily } from './fontDetector';
import type { ThemePreset } from './theme';

export const readerContentWidths = ['narrow', 'comfortable', 'wide'] as const;
export const readerParagraphSpacings = ['compact', 'comfortable', 'relaxed'] as const;

export type ReaderContentWidth = (typeof readerContentWidths)[number];
export type ReaderParagraphSpacing = (typeof readerParagraphSpacings)[number];
export type ReaderTypographyPresetId = 'focus' | 'night' | 'book' | 'clarity' | 'compact';

export interface ReaderTypographyInput {
  content_font_family?: unknown;
  content_font_size?: unknown;
  content_line_height?: unknown;
  content_width?: unknown;
  content_paragraph_spacing?: unknown;
}

export interface ReaderTypographyValues {
  content_font_family: string;
  content_font_size: number;
  content_line_height: string;
  content_width: ReaderContentWidth;
  content_paragraph_spacing: ReaderParagraphSpacing;
}

export interface ReaderTypographyPreset {
  id: ReaderTypographyPresetId;
  values: ReaderTypographyValues;
}

export interface ReaderTypography {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  width: ReaderContentWidth;
  paragraphSpacing: ReaderParagraphSpacing;
  cssVariables: Record<
    | '--reader-font-family'
    | '--reader-font-size'
    | '--reader-line-height'
    | '--reader-paragraph-gap',
    string
  >;
}

const readerTypographyDefaults: ReaderTypographyValues = {
  content_font_family: 'system',
  content_font_size: 16,
  content_line_height: '1.6',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
};

const paragraphGaps: Record<ReaderParagraphSpacing, string> = {
  compact: '0.75em',
  comfortable: '1.15em',
  relaxed: '1.6em',
};

export const readerTypographyPresets = [
  {
    id: 'focus',
    values: {
      content_font_family: 'system',
      content_font_size: 16,
      content_line_height: '1.6',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
    },
  },
  {
    id: 'night',
    values: {
      content_font_family: 'system',
      content_font_size: 17,
      content_line_height: '1.7',
      content_width: 'comfortable',
      content_paragraph_spacing: 'relaxed',
    },
  },
  {
    id: 'book',
    values: {
      content_font_family: 'serif',
      content_font_size: 18,
      content_line_height: '1.8',
      content_width: 'narrow',
      content_paragraph_spacing: 'relaxed',
    },
  },
  {
    id: 'clarity',
    values: {
      content_font_family: 'system',
      content_font_size: 18,
      content_line_height: '1.8',
      content_width: 'comfortable',
      content_paragraph_spacing: 'relaxed',
    },
  },
  {
    id: 'compact',
    values: {
      content_font_family: 'sans-serif',
      content_font_size: 15,
      content_line_height: '1.5',
      content_width: 'wide',
      content_paragraph_spacing: 'compact',
    },
  },
] as const satisfies readonly ReaderTypographyPreset[];

export const readerThemePresetMap = {
  paper: 'focus',
  ink: 'night',
  sepia: 'book',
  'high-contrast': 'clarity',
} as const satisfies Readonly<Record<ThemePreset, ReaderTypographyPresetId>>;

function isReaderContentWidth(value: unknown): value is ReaderContentWidth {
  return typeof value === 'string' && readerContentWidths.includes(value as ReaderContentWidth);
}

function isReaderParagraphSpacing(value: unknown): value is ReaderParagraphSpacing {
  return (
    typeof value === 'string' && readerParagraphSpacings.includes(value as ReaderParagraphSpacing)
  );
}

function normalizeFontFamily(value: unknown): string {
  if (typeof value !== 'string') return readerTypographyDefaults.content_font_family;

  return value.trim() || readerTypographyDefaults.content_font_family;
}

function normalizeFontSize(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 10 || numericValue > 24) {
    return readerTypographyDefaults.content_font_size;
  }

  return numericValue;
}

function normalizeLineHeight(value: unknown): string {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 1 || numericValue > 3) {
    return readerTypographyDefaults.content_line_height;
  }

  return String(numericValue);
}

export function normalizeReaderTypography(input: ReaderTypographyInput): ReaderTypographyValues {
  return {
    content_font_family: normalizeFontFamily(input.content_font_family),
    content_font_size: normalizeFontSize(input.content_font_size),
    content_line_height: normalizeLineHeight(input.content_line_height),
    content_width: isReaderContentWidth(input.content_width)
      ? input.content_width
      : readerTypographyDefaults.content_width,
    content_paragraph_spacing: isReaderParagraphSpacing(input.content_paragraph_spacing)
      ? input.content_paragraph_spacing
      : readerTypographyDefaults.content_paragraph_spacing,
  };
}

export function resolveReaderTypography(input: ReaderTypographyInput): ReaderTypography {
  const values = normalizeReaderTypography(input);
  const lineHeight = Number(values.content_line_height);

  return {
    fontFamily: values.content_font_family,
    fontSize: values.content_font_size,
    lineHeight,
    width: values.content_width,
    paragraphSpacing: values.content_paragraph_spacing,
    cssVariables: {
      '--reader-font-family': resolveFontFamily(values.content_font_family),
      '--reader-font-size': `${values.content_font_size}px`,
      '--reader-line-height': values.content_line_height,
      '--reader-paragraph-gap': paragraphGaps[values.content_paragraph_spacing],
    },
  };
}

function matchesPreset(values: ReaderTypographyValues, preset: ReaderTypographyPreset): boolean {
  return (
    values.content_font_family === preset.values.content_font_family &&
    values.content_font_size === preset.values.content_font_size &&
    values.content_line_height === preset.values.content_line_height &&
    values.content_width === preset.values.content_width &&
    values.content_paragraph_spacing === preset.values.content_paragraph_spacing
  );
}

export function getReaderTypographyPreset(
  input: ReaderTypographyInput
): ReaderTypographyPresetId | 'custom' {
  const values = normalizeReaderTypography(input);
  const preset = readerTypographyPresets.find((candidate) => matchesPreset(values, candidate));

  return preset?.id ?? 'custom';
}

export function getRecommendedReaderTypographyPreset(theme: unknown): ReaderTypographyPreset {
  const presetId = readerThemePresetMap[theme as ThemePreset] ?? 'focus';
  const preset = readerTypographyPresets.find((candidate) => candidate.id === presetId);

  return preset ?? readerTypographyPresets[0];
}
