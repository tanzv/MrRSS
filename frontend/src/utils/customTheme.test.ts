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

const stateContrastPairs = [
  ['state-favorite-color', 'state-favorite-background'],
  ['state-read-later-color', 'state-read-later-background'],
  ['state-info-color', 'state-info-background'],
  ['state-success-color', 'state-success-background'],
  ['state-warning-color', 'state-warning-background'],
  ['state-danger-color', 'state-danger-background'],
] as const;

const readableTokens = {
  ...baseTokens,
  'bg-primary': '#ffffff',
  'surface-rail': '#ffffff',
  'surface-panel': '#ffffff',
  'surface-hover': '#ffffff',
  'surface-selected': '#ffffff',
  'text-primary': '#000000',
  'text-secondary': '#000000',
  'accent-text-color': '#000000',
  'accent-color': '#005fcc',
  'accent-hover': '#004caa',
  'accent-foreground': '#ffffff',
  'selection-background': '#005fcc',
  'selection-color': '#ffffff',
  'unread-badge-background': '#005fcc',
  'unread-badge-color': '#ffffff',
  ...Object.fromEntries(
    stateContrastPairs.flatMap(([foreground, background]) => [
      [foreground, '#000000'],
      [background, '#ffffff'],
    ])
  ),
} as Record<ThemeTokenKey, string>;

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

  it('rejects unreadable accent-action and selection foregrounds', () => {
    const report = validateThemeContrast({
      ...readableTokens,
      'accent-color': '#ffffff',
      'accent-hover': '#ffffff',
      'accent-foreground': '#ffffff',
      'selection-background': '#ffffff',
      'selection-color': '#ffffff',
    });

    expect(report).toMatchObject({
      accentForeground: { passes: false },
      accentHover: { passes: false },
      selection: { passes: false },
    });
    expect(themeContrastPasses(report)).toBe(false);
  });

  it('rejects unreadable sidebar rail, panel, selection, and badge pairings', () => {
    const report = validateThemeContrast({
      ...readableTokens,
      'surface-rail': '#000000',
      'surface-panel': '#000000',
      'surface-hover': '#000000',
      'surface-selected': '#000000',
      'text-primary': '#000000',
      'text-secondary': '#000000',
      'accent-text-color': '#000000',
      'unread-badge-background': '#000000',
      'unread-badge-color': '#000000',
    });

    expect(report.railSecondary.passes).toBe(false);
    expect(report.panelPrimary.passes).toBe(false);
    expect(report.panelSecondary.passes).toBe(false);
    expect(report.hoverPrimary.passes).toBe(false);
    expect(report.hoverSecondary.passes).toBe(false);
    expect(report.railAccent.passes).toBe(false);
    expect(report.panelAccent.passes).toBe(false);
    expect(report.hoverAccent.passes).toBe(false);
    expect(report.selectedAccent.passes).toBe(false);
    expect(report.selectedSecondary.passes).toBe(false);
    expect(report.panelWarning.passes).toBe(false);
    expect(report.hoverWarning.passes).toBe(false);
    expect(report.selectedWarning.passes).toBe(false);
    expect(report.unreadBadge.passes).toBe(false);
    expect(themeContrastPasses(report)).toBe(false);
  });

  it('rejects warning colors that disappear in a pinned sidebar drawer', () => {
    const report = validateThemeContrast({
      ...readableTokens,
      'bg-primary': '#000000',
      'surface-rail': '#000000',
      'surface-panel': '#767676',
      'surface-hover': '#767676',
      'surface-selected': '#767676',
      'text-primary': '#ffffff',
      'text-secondary': '#ffffff',
      'accent-text-color': '#ffffff',
      'state-warning-color': '#000000',
      'state-warning-background': '#ffffff',
    });

    expect(report.backgroundWarning.passes).toBe(false);
    expect(themeContrastPasses(report)).toBe(false);
  });

  it('rejects auxiliary sidebar icon colors that fail on selected and interactive surfaces', () => {
    const report = validateThemeContrast({
      ...readableTokens,
      'bg-primary': '#000000',
      'surface-rail': '#000000',
      'surface-panel': '#000000',
      'surface-hover': '#000000',
      'surface-selected': '#767676',
      'text-secondary': '#767676',
      'accent-text-color': '#ffffff',
      'state-warning-color': '#000000',
      'state-warning-background': '#ffffff',
    });

    expect(report.selectedSecondary.passes).toBe(false);
    expect(report.panelWarning.passes).toBe(false);
    expect(report.hoverWarning.passes).toBe(false);
    expect(themeContrastPasses(report)).toBe(false);
  });

  it('rejects translucent contrast backgrounds with an unknown rendered backdrop', () => {
    const report = validateThemeContrast({
      ...readableTokens,
      'accent-color': '#00000000',
      'accent-hover': '#00000000',
      'accent-foreground': '#000000',
      'selection-background': '#00000000',
      'selection-color': '#000000',
      'state-success-background': '#00000000',
      'state-success-color': '#000000',
    });

    expect(report).toMatchObject({
      accentForeground: { passes: false },
      accentHover: { passes: false },
      selection: { passes: false },
    });
    expect(report.states[3]).toMatchObject({ passes: false });
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
