import {
  builtInThemePresets,
  themeTokenKeys,
  type BuiltInThemePreset,
  type ContrastCheck,
  type CustomThemeProfile,
  type ThemeContrastReport,
  type ThemeTokenKey,
  type ThemeTokenOverrides,
  type ThemeProfilesDocument,
} from '@/types/theme';

export const CUSTOM_THEME_MAX_PROFILES = 20;
export const CUSTOM_THEME_MAX_BYTES = 512 * 1024;
export const CUSTOM_THEME_MAX_NAME_LENGTH = 48;
export const CUSTOM_THEME_MIN_FONT_SIZE = 12;
export const CUSTOM_THEME_MAX_FONT_SIZE = 20;

const themeTokenKeySet = new Set<string>(themeTokenKeys);
const builtInThemePresetSet = new Set<string>(builtInThemePresets);
const themeProfileFieldSet = new Set([
  'id',
  'name',
  'basePreset',
  'appearance',
  'light',
  'dark',
  'uiFontFamily',
  'uiFontSize',
  'updatedAt',
]);
const hexColorPattern = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const safeFontPattern = /^[\w\s,'".-]+$/u;

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  return (name || 'Custom theme').slice(0, CUSTOM_THEME_MAX_NAME_LENGTH);
}

function normalizeId(value: unknown, fallback: string): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
    return id;
  }
  return fallback;
}

function normalizeFontFamily(value: unknown): string {
  const font = typeof value === 'string' ? value.trim() : '';
  if (!font || font === 'system') {
    return 'system';
  }

  if (font.length > 120 || !safeFontPattern.test(font) || /[;{}()<>]/u.test(font)) {
    return 'system';
  }

  return font;
}

function normalizeFontSize(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return 16;
  }

  return Math.min(
    CUSTOM_THEME_MAX_FONT_SIZE,
    Math.max(CUSTOM_THEME_MIN_FONT_SIZE, Math.round(numericValue))
  );
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string' || !hexColorPattern.test(value.trim())) {
    return null;
  }

  return value.trim().toLowerCase();
}

function sanitizeOverrides(value: unknown): ThemeTokenOverrides {
  if (!isRecord(value)) {
    return {};
  }

  const overrides: ThemeTokenOverrides = {};
  for (const [key, rawColor] of Object.entries(value)) {
    if (!themeTokenKeySet.has(key)) {
      continue;
    }

    const color = normalizeHexColor(rawColor);
    if (color) {
      overrides[key as ThemeTokenKey] = color;
    }
  }

  return overrides;
}

function sanitizeProfile(value: unknown, index: number): CustomThemeProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const basePreset = builtInThemePresetSet.has(String(value.basePreset))
    ? (value.basePreset as BuiltInThemePreset)
    : 'paper';
  const appearance =
    value.appearance === 'light' || value.appearance === 'dark' || value.appearance === 'auto'
      ? value.appearance
      : 'auto';

  return {
    id: normalizeId(value.id, `custom-${index + 1}`),
    name: normalizeName(value.name),
    basePreset,
    appearance,
    light: sanitizeOverrides(value.light),
    dark: sanitizeOverrides(value.dark),
    uiFontFamily: normalizeFontFamily(value.uiFontFamily),
    uiFontSize: normalizeFontSize(value.uiFontSize),
    updatedAt:
      typeof value.updatedAt === 'string' && value.updatedAt.trim()
        ? value.updatedAt
        : new Date().toISOString(),
  };
}

function parseRawProfiles(raw: unknown): unknown[] | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (isRecord(value) && value.version === 1 && Array.isArray(value.profiles)) {
    value = value.profiles;
  }

  return Array.isArray(value) ? value : null;
}

export function parseThemeProfiles(raw: unknown): CustomThemeProfile[] {
  if (typeof raw === 'string' && byteLength(raw) > CUSTOM_THEME_MAX_BYTES) {
    return [];
  }

  const values = parseRawProfiles(raw);
  if (!values || values.length > CUSTOM_THEME_MAX_PROFILES) {
    return [];
  }

  const seenIds = new Set<string>();
  const profiles: CustomThemeProfile[] = [];
  values.forEach((value, index) => {
    const profile = sanitizeProfile(value, index);
    if (!profile || seenIds.has(profile.id)) {
      return;
    }
    seenIds.add(profile.id);
    profiles.push(profile);
  });

  return profiles;
}

export function serializeThemeProfiles(profiles: CustomThemeProfile[]): string {
  if (profiles.length > CUSTOM_THEME_MAX_PROFILES) {
    throw new RangeError(`A maximum of ${CUSTOM_THEME_MAX_PROFILES} custom themes is supported`);
  }

  const normalized = parseThemeProfiles(profiles);

  const serialized = JSON.stringify(normalized);
  if (byteLength(serialized) > CUSTOM_THEME_MAX_BYTES) {
    throw new RangeError('Custom theme data is too large');
  }

  return serialized;
}

export function mergeThemeTokens(
  base: Record<ThemeTokenKey, string>,
  overrides: ThemeTokenOverrides
): Record<ThemeTokenKey, string> {
  const merged = { ...base };
  for (const [key, rawColor] of Object.entries(overrides)) {
    if (!themeTokenKeySet.has(key)) {
      continue;
    }

    const color = normalizeHexColor(rawColor);
    if (color) {
      merged[key as ThemeTokenKey] = color;
    }
  }
  return merged;
}

interface ParsedColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function parseHexColor(value: unknown): ParsedColor | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) {
    return null;
  }

  const hex = normalized.slice(1);
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
    alpha: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function parseCssColor(value: unknown): ParsedColor | null {
  if (typeof value !== 'string') {
    return null;
  }

  const hexColor = parseHexColor(value);
  if (hexColor) {
    return hexColor;
  }

  const match = value.trim().match(/^rgba?\((.*)\)$/i);
  if (!match) {
    return null;
  }

  const components = match[1]
    .replace('/', ' / ')
    .split(/[\s,]+/u)
    .filter(Boolean);
  if (components.length < 3 || components.length > 5) {
    return null;
  }

  const channel = (component: string): number | null => {
    const isPercent = component.endsWith('%');
    const numeric = Number.parseFloat(isPercent ? component.slice(0, -1) : component);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    const normalized = isPercent ? (numeric / 100) * 255 : numeric;
    return normalized >= 0 && normalized <= 255 ? normalized : null;
  };

  const red = channel(components[0]);
  const green = channel(components[1]);
  const blue = channel(components[2]);
  if (red === null || green === null || blue === null) {
    return null;
  }

  let alpha = 1;
  const alphaComponent = components[3] === '/' ? components[4] : components[3];
  if (alphaComponent !== undefined) {
    const numeric = Number.parseFloat(
      alphaComponent.endsWith('%') ? alphaComponent.slice(0, -1) : alphaComponent
    );
    if (!Number.isFinite(numeric)) {
      return null;
    }
    alpha = alphaComponent.endsWith('%') ? numeric / 100 : numeric;
    if (alpha < 0 || alpha > 1) {
      return null;
    }
  }

  return { red, green, blue, alpha };
}

function blendColor(foreground: ParsedColor, background: ParsedColor): ParsedColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) {
    return { red: 255, green: 255, blue: 255, alpha: 1 };
  }

  return {
    red:
      (foreground.red * foreground.alpha +
        background.red * background.alpha * (1 - foreground.alpha)) /
      alpha,
    green:
      (foreground.green * foreground.alpha +
        background.green * background.alpha * (1 - foreground.alpha)) /
      alpha,
    blue:
      (foreground.blue * foreground.alpha +
        background.blue * background.alpha * (1 - foreground.alpha)) /
      alpha,
    alpha,
  };
}

function relativeLuminance(color: ParsedColor): number {
  const channels = [color.red, color.green, color.blue].map((channel) => channel / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function calculateContrastRatio(foreground: string, background: string): number {
  const foregroundColor = parseCssColor(foreground);
  const backgroundColor = parseCssColor(background);
  if (!foregroundColor || !backgroundColor) {
    return Number.NaN;
  }

  const blendedForeground =
    foregroundColor.alpha < 1 ? blendColor(foregroundColor, backgroundColor) : foregroundColor;
  const blendedBackground =
    backgroundColor.alpha < 1
      ? blendColor(backgroundColor, { red: 255, green: 255, blue: 255, alpha: 1 })
      : backgroundColor;
  const lighter = Math.max(
    relativeLuminance(blendedForeground),
    relativeLuminance(blendedBackground)
  );
  const darker = Math.min(
    relativeLuminance(blendedForeground),
    relativeLuminance(blendedBackground)
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastCheck(foreground: string, background: string): ContrastCheck {
  const ratio = calculateContrastRatio(foreground, background);
  return {
    foreground,
    background,
    ratio: Number.isFinite(ratio) ? ratio : 0,
    passes: Number.isFinite(ratio) && ratio >= 4.5,
  };
}

export function validateThemeContrast(tokens: Record<ThemeTokenKey, string>): ThemeContrastReport {
  const background = tokens['bg-primary'];
  const states = [
    ['state-favorite-color', 'state-favorite-background'],
    ['state-read-later-color', 'state-read-later-background'],
    ['state-info-color', 'state-info-background'],
    ['state-success-color', 'state-success-background'],
    ['state-warning-color', 'state-warning-background'],
    ['state-danger-color', 'state-danger-background'],
  ] as const;

  return {
    primary: contrastCheck(tokens['text-primary'], background),
    secondary: contrastCheck(tokens['text-secondary'], background),
    accent: contrastCheck(tokens['accent-text-color'], background),
    states: states.map(([foregroundKey, backgroundKey]) =>
      contrastCheck(tokens[foregroundKey], tokens[backgroundKey])
    ),
  };
}

export function themeContrastPasses(report: ThemeContrastReport): boolean {
  return [report.primary, report.secondary, report.accent, ...report.states].every(
    (check) => check.passes
  );
}

export function createCustomThemeProfile(
  name: string,
  basePreset: BuiltInThemePreset,
  font: string,
  size: number
): CustomThemeProfile {
  const normalizedName = normalizeName(name);
  const slug = normalizedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const randomSuffix =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return {
    id: `custom-${slug || 'theme'}-${randomSuffix}`,
    name: normalizedName,
    basePreset: builtInThemePresetSet.has(basePreset) ? basePreset : 'paper',
    appearance: 'auto',
    light: {},
    dark: {},
    uiFontFamily: normalizeFontFamily(font),
    uiFontSize: normalizeFontSize(size),
    updatedAt: new Date().toISOString(),
  };
}

export function getThemePreferenceId(profile: CustomThemeProfile): `custom:${string}` {
  return `custom:${profile.id}`;
}

export function getThemeProfileOverrides(
  profile: CustomThemeProfile,
  prefersDark: boolean
): ThemeTokenOverrides {
  if (profile.appearance === 'light') {
    return profile.light;
  }
  if (profile.appearance === 'dark') {
    return profile.dark;
  }
  return prefersDark ? profile.dark : profile.light;
}

function isStrictThemeProfile(value: unknown): value is CustomThemeProfile {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== themeProfileFieldSet.size ||
    keys.some((key) => !themeProfileFieldSet.has(key))
  ) {
    return false;
  }

  const id = value.id;
  const name = value.name;
  const basePreset = value.basePreset;
  const appearance = value.appearance;
  const font = value.uiFontFamily;
  const size = value.uiFontSize;
  const updatedAt = value.updatedAt;

  return (
    typeof id === 'string' &&
    /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id) &&
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= CUSTOM_THEME_MAX_NAME_LENGTH &&
    typeof basePreset === 'string' &&
    builtInThemePresetSet.has(basePreset) &&
    (appearance === 'light' || appearance === 'dark' || appearance === 'auto') &&
    isRecord(value.light) &&
    isRecord(value.dark) &&
    Object.entries(value.light).every(
      ([key, color]) => themeTokenKeySet.has(key) && normalizeHexColor(color) !== null
    ) &&
    Object.entries(value.dark).every(
      ([key, color]) => themeTokenKeySet.has(key) && normalizeHexColor(color) !== null
    ) &&
    typeof font === 'string' &&
    normalizeFontFamily(font) === font &&
    typeof size === 'number' &&
    Number.isInteger(size) &&
    size >= CUSTOM_THEME_MIN_FONT_SIZE &&
    size <= CUSTOM_THEME_MAX_FONT_SIZE &&
    typeof updatedAt === 'string' &&
    updatedAt.length <= 128 &&
    updatedAt.trim().length > 0
  );
}

export function isThemeProfilesArray(value: unknown): value is CustomThemeProfile[] {
  if (!Array.isArray(value) || value.length > CUSTOM_THEME_MAX_PROFILES) {
    return false;
  }

  const seenIds = new Set<string>();
  return value.every((profile) => {
    if (!isStrictThemeProfile(profile) || seenIds.has(profile.id)) {
      return false;
    }
    seenIds.add(profile.id);
    return true;
  });
}

export function isThemeProfilesDocument(value: unknown): value is ThemeProfilesDocument {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    Object.keys(value).every((key) => key === 'version' || key === 'profiles') &&
    value.version === 1 &&
    isThemeProfilesArray(value.profiles)
  );
}

export function isThemeTokenKey(value: string): value is ThemeTokenKey {
  return themeTokenKeySet.has(value);
}
