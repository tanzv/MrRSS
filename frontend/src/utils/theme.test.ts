import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyCustomTheme,
  applyThemePreference,
  clearCustomThemeOverrides,
  isDarkThemePreset,
  normalizeThemePreference,
  resolveThemePreset,
} from './theme';
import type { CustomThemeProfile } from '@/types/theme';
import { themeTokenKeys } from '@/types/theme';
const themeStyles = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');

function resetThemeDom() {
  document.documentElement.removeAttribute('data-theme-preset');
  document.documentElement.classList.remove('dark-mode');
  document.documentElement.style.removeProperty('background-color');
  document.body.classList.remove('dark-mode');
  document.body.style.removeProperty('background-color');
  clearCustomThemeOverrides();
  document.documentElement.style.removeProperty('--ui-font-family');
  document.documentElement.style.removeProperty('--ui-font-size');
  localStorage.removeItem('themePreference');
}

afterEach(resetThemeDom);

describe('theme preferences', () => {
  it.each(['paper', 'ink', 'sepia', 'high-contrast'] as const)(
    'defines every editable token for the %s preset',
    (preset) => {
      const selector = preset === 'paper' ? ':root {' : `:root[data-theme-preset='${preset}'] {`;
      const start = themeStyles.indexOf(selector);
      const end = start === -1 ? -1 : themeStyles.indexOf('\n  }', start);
      const tokenBlock = start === -1 || end === -1 ? '' : themeStyles.slice(start, end);

      expect(tokenBlock).toBeTruthy();
      themeTokenKeys.forEach((key) => {
        expect(tokenBlock).toMatch(
          new RegExp(`--${key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}:\\s*[^;]+;`)
        );
      });
    }
  );

  it('normalizes legacy, canonical, and unknown values', () => {
    expect(normalizeThemePreference('light')).toBe('paper');
    expect(normalizeThemePreference('dark')).toBe('ink');
    expect(normalizeThemePreference('paper')).toBe('paper');
    expect(normalizeThemePreference('ink')).toBe('ink');
    expect(normalizeThemePreference('sepia')).toBe('sepia');
    expect(normalizeThemePreference('high-contrast')).toBe('high-contrast');
    expect(normalizeThemePreference('auto')).toBe('auto');
    expect(normalizeThemePreference('unexpected')).toBe('auto');
    expect(normalizeThemePreference(undefined)).toBe('auto');
  });

  it('resolves auto from the system scheme without changing manual presets', () => {
    expect(resolveThemePreset('auto', false)).toBe('paper');
    expect(resolveThemePreset('auto', true)).toBe('ink');
    expect(resolveThemePreset('sepia', true)).toBe('sepia');
    expect(resolveThemePreset('high-contrast', false)).toBe('high-contrast');
  });

  it('identifies the presets that use existing dark-mode content styles', () => {
    expect(isDarkThemePreset('paper')).toBe(false);
    expect(isDarkThemePreset('sepia')).toBe(false);
    expect(isDarkThemePreset('ink')).toBe(true);
    expect(isDarkThemePreset('high-contrast')).toBe(true);
  });

  it('applies a canonical preset to document roots and persistent storage', () => {
    const resolvedTheme = applyThemePreference('high-contrast', false);

    expect(resolvedTheme).toBe('high-contrast');
    expect(document.documentElement.dataset.themePreset).toBe('high-contrast');
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);
    expect(document.body.classList.contains('dark-mode')).toBe(true);
    expect(localStorage.getItem('themePreference')).toBe('high-contrast');
  });

  it('removes dark mode for light presets and persists normalized legacy values', () => {
    document.documentElement.classList.add('dark-mode');
    document.body.classList.add('dark-mode');

    const resolvedTheme = applyThemePreference('light', true);

    expect(resolvedTheme).toBe('paper');
    expect(document.documentElement.dataset.themePreset).toBe('paper');
    expect(document.documentElement.classList.contains('dark-mode')).toBe(false);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
    expect(localStorage.getItem('themePreference')).toBe('paper');
  });

  it('applies a custom profile and clears its inline tokens when returning to a preset', () => {
    const profile: CustomThemeProfile = {
      id: 'focus',
      name: 'Focus',
      basePreset: 'paper',
      appearance: 'light',
      light: { 'accent-color': '#123456', 'surface-panel': '#f0f0f0' },
      dark: { 'accent-color': '#abcdef' },
      uiFontFamily: 'system',
      uiFontSize: 18,
      updatedAt: '2026-08-23T00:00:00.000Z',
    };

    expect(applyCustomTheme(profile, false)).toBe('paper');
    expect(document.documentElement.style.getPropertyValue('--accent-color')).toBe('#123456');
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('18 52 86');
    expect(document.documentElement.style.getPropertyValue('--ui-font-size')).toBe('18px');

    applyThemePreference('paper', false);
    expect(document.documentElement.style.getPropertyValue('--accent-color')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('');
    expect(document.documentElement.dataset.themeProfile).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--ui-font-size')).toBe('18px');
  });

  it('uses the selected custom variant for dark mode and page background', () => {
    const profile: CustomThemeProfile = {
      id: 'variant-mode',
      name: 'Variant mode',
      basePreset: 'paper',
      appearance: 'dark',
      light: { 'bg-primary': '#f8f8f8' },
      dark: { 'bg-primary': '#101010' },
      uiFontFamily: 'system',
      uiFontSize: 16,
      updatedAt: '2026-08-23T00:00:00.000Z',
    };

    applyCustomTheme(profile, false);

    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);
    expect(document.body.classList.contains('dark-mode')).toBe(true);
    expect(document.documentElement.style.backgroundColor).toBe('rgb(16, 16, 16)');
    expect(document.body.style.backgroundColor).toBe('rgb(16, 16, 16)');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyCustomTheme({ ...profile, appearance: 'light' }, false);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(false);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
    expect(document.documentElement.style.backgroundColor).toBe('rgb(248, 248, 248)');
  });

  it.each(['paper', 'ink', 'sepia', 'high-contrast'] as const)(
    'defines readable shell tokens for the %s preset',
    (preset) => {
      const selector = preset === 'paper' ? ':root {' : `:root[data-theme-preset='${preset}'] {`;
      const start = themeStyles.indexOf(selector);
      const end = start === -1 ? -1 : themeStyles.indexOf('\n  }', start);
      const tokenBlock = start === -1 || end === -1 ? undefined : themeStyles.slice(start, end);

      expect(tokenBlock).toBeTruthy();
      expect(tokenBlock).toMatch(/--surface-rail:\s*[^;]+;/);
      expect(tokenBlock).toMatch(/--surface-panel:\s*[^;]+;/);
      expect(tokenBlock).toMatch(/--surface-selected:\s*[^;]+;/);
      expect(tokenBlock).toMatch(/--text-tertiary:\s*[^;]+;/);
      expect(tokenBlock).toMatch(/--overlay-backdrop:\s*[^;]+;/);
      expect(tokenBlock).toMatch(/--overlay-shadow:\s*[^;]+;/);
    }
  );

  it.each(['paper', 'ink', 'sepia', 'high-contrast'] as const)(
    'defines readable media overlay tokens for the %s preset',
    (preset) => {
      const selector = preset === 'paper' ? ':root {' : `:root[data-theme-preset='${preset}'] {`;
      const start = themeStyles.indexOf(selector);
      const end = start === -1 ? -1 : themeStyles.indexOf('\n  }', start);
      const tokenBlock = start === -1 || end === -1 ? undefined : themeStyles.slice(start, end);
      const requiredTokens = [
        '--media-overlay-background',
        '--media-overlay-hover-background',
        '--media-overlay-strong-background',
        '--media-overlay-foreground',
        '--media-overlay-muted-foreground',
        '--media-control-background',
        '--media-control-hover-background',
        '--media-control-foreground',
        '--media-badge-background',
        '--media-badge-foreground',
        '--media-viewer-background',
        '--media-viewer-border',
      ];

      expect(tokenBlock).toBeTruthy();
      requiredTokens.forEach((token) => {
        expect(tokenBlock).toMatch(new RegExp(`${token}:\\s*[^;]+;`));
      });
    }
  );

  it.each(['paper', 'ink', 'sepia', 'high-contrast'] as const)(
    'defines article content shadow tokens for the %s preset',
    (preset) => {
      const selector = preset === 'paper' ? ':root {' : `:root[data-theme-preset='${preset}'] {`;
      const start = themeStyles.indexOf(selector);
      const end = start === -1 ? -1 : themeStyles.indexOf('\n  }', start);
      const tokenBlock = start === -1 || end === -1 ? undefined : themeStyles.slice(start, end);

      expect(tokenBlock).toBeTruthy();
      expect(tokenBlock).toMatch(/--content-shadow:\s*[^;]+;/);
      expect(tokenBlock).toMatch(/--content-shadow-hover:\s*[^;]+;/);
      expect(tokenBlock).toMatch(/--content-shadow-subtle:\s*[^;]+;/);
    }
  );
});
