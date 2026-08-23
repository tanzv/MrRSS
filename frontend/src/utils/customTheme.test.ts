import { describe, expect, it } from 'vitest';
import {
  calculateContrastRatio,
  createCustomThemeProfile,
  isThemeProfilesArray,
  isThemeProfilesDocument,
  mergeThemeTokens,
  parseThemeProfiles,
  serializeThemeProfiles,
  themeContrastPasses,
  validateThemeContrast,
} from './customTheme';
import { themeTokenGroups, themeTokenKeys, type ThemeTokenKey } from '@/types/theme';

const baseTokens = Object.fromEntries(themeTokenKeys.map((key) => [key, '#ffffff'])) as Record<
  ThemeTokenKey,
  string
>;

describe('custom theme profiles', () => {
  it('exposes every editable token in exactly one editor group', () => {
    const groupedKeys = Object.values(themeTokenGroups).flat();
    expect(new Set(groupedKeys).size).toBe(themeTokenKeys.length);
    expect(groupedKeys).toEqual(expect.arrayContaining(themeTokenKeys));
  });

  it('keeps only registered, valid token overrides when parsing', () => {
    const profiles = parseThemeProfiles(
      JSON.stringify([
        {
          id: 'focus',
          name: ' Focus ',
          basePreset: 'ink',
          appearance: 'dark',
          light: { 'text-primary': '#ffffff', '--not-allowed': '#000000', 'bg-primary': 'red' },
          dark: {},
          uiFontFamily: 'system',
          uiFontSize: 16,
          updatedAt: '2026-08-23T00:00:00.000Z',
        },
      ])
    );

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Focus');
    expect(profiles[0].light).toEqual({ 'text-primary': '#ffffff' });
  });

  it('returns an empty list for malformed or oversized profile data', () => {
    expect(parseThemeProfiles('{broken')).toEqual([]);
    expect(parseThemeProfiles(JSON.stringify(new Array(21).fill({})))).toEqual([]);
    expect(parseThemeProfiles('x'.repeat(512 * 1024 + 1))).toEqual([]);
  });

  it('clamps profile names and application font size', () => {
    const profile = createCustomThemeProfile('  '.padEnd(80, 'x'), 'paper', 'system', 99);

    expect(profile.name).toHaveLength(48);
    expect(profile.uiFontSize).toBe(20);
  });

  it('merges sparse overrides without mutating the base token map', () => {
    const merged = mergeThemeTokens(baseTokens, {
      'accent-color': '#123456',
      'not-a-token': '#000000',
    } as never);

    expect(merged['accent-color']).toBe('#123456');
    expect(merged['bg-primary']).toBe('#ffffff');
    expect(baseTokens['accent-color']).toBe('#ffffff');
    expect(Object.keys(merged)).not.toContain('not-a-token');
  });

  it('calculates the maximum contrast ratio for black and white', () => {
    expect(calculateContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('blends alpha colors and rejects malformed colors', () => {
    expect(calculateContrastRatio('#00000080', '#ffffff')).toBeGreaterThan(3);
    expect(calculateContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBeCloseTo(21, 5);
    expect(calculateContrastRatio('rgba(0 0 0 / 50%)', '#ffffff')).toBeGreaterThan(3);
    expect(Number.isNaN(calculateContrastRatio('red', '#ffffff'))).toBe(true);
    expect(Number.isNaN(calculateContrastRatio(undefined as never, '#ffffff'))).toBe(true);
  });

  it('reports primary and state contrast failures', () => {
    const report = validateThemeContrast({
      ...baseTokens,
      'bg-primary': '#ffffff',
      'text-primary': '#eeeeee',
      'text-secondary': '#666666',
      'accent-text-color': '#eeeeee',
      'state-success-color': '#eeeeee',
      'state-success-background': '#ffffff',
    });

    expect(report.primary.passes).toBe(false);
    expect(report.secondary.passes).toBe(true);
    expect(report.states.some((state) => !state.passes)).toBe(true);
    expect(themeContrastPasses(report)).toBe(false);
  });

  it('serializes sanitized profiles as a stable JSON array', () => {
    const profile = createCustomThemeProfile('Focus', 'paper', 'system', 16);
    const serialized = serializeThemeProfiles([profile]);

    expect(serialized.startsWith('[')).toBe(true);
    expect(parseThemeProfiles(serialized)).toEqual([profile]);
  });

  it('strictly validates import documents without weakening startup parsing', () => {
    const profile = createCustomThemeProfile('Focus', 'paper', 'system', 16);
    expect(isThemeProfilesArray([profile])).toBe(true);
    expect(isThemeProfilesDocument({ version: 1, profiles: [profile] })).toBe(true);
    expect(isThemeProfilesDocument({ version: 1, profiles: [profile], extra: true })).toBe(false);
    expect(isThemeProfilesArray([{ id: profile.id }])).toBe(false);
    expect(isThemeProfilesDocument({ version: 1, profiles: [{ id: profile.id }] })).toBe(false);
    expect(parseThemeProfiles([{ id: profile.id }])).toHaveLength(1);
  });

  it('rejects serialization beyond the profile limit', () => {
    const profile = createCustomThemeProfile('Focus', 'paper', 'system', 16);
    expect(() => serializeThemeProfiles(new Array(21).fill(profile))).toThrow(RangeError);
  });
});
