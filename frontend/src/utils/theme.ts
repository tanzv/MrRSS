import { resolveFontFamily } from './fontDetector';
import {
  builtInThemePresets,
  themeTokenKeys,
  type BuiltInThemePreset,
  type CustomThemeProfile,
  type ThemePreference as ThemePreferenceValue,
} from '@/types/theme';

export const themePreferences = ['auto', ...builtInThemePresets] as const;

export type ThemePreference = ThemePreferenceValue;
export type ThemePreset = BuiltInThemePreset;

export const themeBackgroundColors: Record<ThemePreset, string> = {
  paper: '#ffffff',
  ink: '#1e1e1e',
  sepia: '#f7f1e3',
  'high-contrast': '#000000',
};

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === 'light') {
    return 'paper';
  }

  if (value === 'dark') {
    return 'ink';
  }

  if (typeof value === 'string' && /^custom:[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) {
    return value as ThemePreference;
  }

  return themePreferences.includes(value as (typeof themePreferences)[number])
    ? (value as ThemePreference)
    : 'auto';
}

export function resolveThemePreset(preference: ThemePreference, prefersDark: boolean): ThemePreset {
  if (preference === 'auto' || preference.startsWith('custom:')) {
    return prefersDark ? 'ink' : 'paper';
  }

  return preference;
}

export function isDarkThemePreset(preset: ThemePreset): boolean {
  return preset === 'ink' || preset === 'high-contrast';
}

export function getSystemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'auto';
  }

  try {
    return normalizeThemePreference(window.localStorage.getItem('themePreference'));
  } catch {
    return 'auto';
  }
}

function applyResolvedPreset(
  preset: ThemePreset,
  root: HTMLElement = document.documentElement,
  darkMode = isDarkThemePreset(preset)
): void {
  clearCustomThemeTokens(root);

  if (typeof document !== 'undefined') {
    root.dataset.themePreset = preset;
    root.classList.toggle('dark-mode', darkMode);
    root.style.backgroundColor = themeBackgroundColors[preset];
    root.style.colorScheme = darkMode ? 'dark' : 'light';

    if (document.body) {
      document.body.classList.toggle('dark-mode', darkMode);
      document.body.style.backgroundColor = themeBackgroundColors[preset];
    }
  }
}

function clearCustomThemeTokens(root: HTMLElement): void {
  if (typeof document === 'undefined' || !root) {
    return;
  }

  themeTokenKeys.forEach((key) => root.style.removeProperty(`--${key}`));
  root.style.removeProperty('--accent-rgb');
  root.removeAttribute('data-theme-profile');
}

function hexToRgbChannels(value: string): string | null {
  const match = value.trim().match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (!match) return null;
  const hex = match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(' ');
}

export function clearCustomThemeOverrides(root: HTMLElement = document.documentElement): void {
  clearCustomThemeTokens(root);
  root.style.removeProperty('--ui-font-family');
  root.style.removeProperty('--ui-font-size');
  root.style.removeProperty('--ui-font-scale');
}

export function applyThemePreference(
  preference: ThemePreference | string,
  prefersDark: boolean
): ThemePreset {
  const normalizedPreference = normalizeThemePreference(preference);
  const preset = resolveThemePreset(normalizedPreference, prefersDark);
  applyResolvedPreset(preset);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('themePreference', normalizedPreference);
    } catch {
      // Theme application remains available when local storage is unavailable.
    }
  }

  return preset;
}

export function applyCustomTheme(
  profile: CustomThemeProfile,
  prefersDark: boolean,
  root: HTMLElement = document.documentElement
): ThemePreset {
  const preset = profile.basePreset;
  const useDarkVariant =
    profile.appearance === 'dark' || (profile.appearance === 'auto' && prefersDark);
  applyResolvedPreset(preset, root, useDarkVariant);
  const overrides =
    profile.appearance === 'dark'
      ? profile.dark
      : profile.appearance === 'light'
        ? profile.light
        : prefersDark
          ? profile.dark
          : profile.light;

  Object.entries(overrides).forEach(([key, value]) => {
    if (themeTokenKeys.includes(key as (typeof themeTokenKeys)[number])) {
      root.style.setProperty(`--${key}`, value);
    }
  });

  const computedStyles = getComputedStyle(root);
  const accentColor =
    root.style.getPropertyValue('--accent-color').trim() ||
    computedStyles.getPropertyValue('--accent-color').trim();
  const accentRgb = hexToRgbChannels(accentColor);
  if (accentRgb) {
    root.style.setProperty('--accent-rgb', accentRgb);
  }

  // Keep the document and body backgrounds aligned with a custom primary
  // surface override instead of the base preset's fallback color.
  const backgroundColor =
    root.style.getPropertyValue('--bg-primary').trim() ||
    computedStyles.getPropertyValue('--bg-primary').trim();
  if (backgroundColor) {
    root.style.backgroundColor = backgroundColor;
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.backgroundColor = backgroundColor;
    }
  }

  root.style.setProperty('--ui-font-family', resolveFontFamily(profile.uiFontFamily));
  root.style.setProperty('--ui-font-size', `${profile.uiFontSize}px`);
  root.style.setProperty('--ui-font-scale', String(profile.uiFontSize / 16));
  root.dataset.themeProfile = profile.id;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('themePreference', `custom:${profile.id}`);
    } catch {
      // Theme application remains available when local storage is unavailable.
    }
  }

  return preset;
}
