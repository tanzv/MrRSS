export const builtInThemePresets = ['paper', 'ink', 'sepia', 'high-contrast'] as const;

export type BuiltInThemePreset = (typeof builtInThemePresets)[number];
export type ThemePreference = 'auto' | BuiltInThemePreset | `custom:${string}`;

export const themeTokenKeys = [
  'bg-primary',
  'bg-secondary',
  'bg-tertiary',
  'surface-rail',
  'surface-panel',
  'surface-hover',
  'surface-selected',
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'accent-color',
  'accent-hover',
  'accent-text-color',
  'accent-foreground',
  'selection-background',
  'selection-color',
  'border-color',
  'mark-bg-color',
  'table-stripe-color',
  'code-bg-color',
  'code-border-color',
  'syntax-plain',
  'syntax-comment',
  'syntax-keyword',
  'syntax-string',
  'syntax-title',
  'syntax-attribute',
  'syntax-meta',
  'syntax-built-in',
  'syntax-formula-background',
  'state-favorite-color',
  'state-favorite-background',
  'state-favorite-border',
  'state-read-later-color',
  'state-read-later-background',
  'state-read-later-border',
  'state-info-color',
  'state-info-background',
  'state-info-border',
  'state-success-color',
  'state-success-background',
  'state-success-border',
  'state-warning-color',
  'state-warning-background',
  'state-warning-border',
  'state-danger-color',
  'state-danger-background',
  'state-danger-border',
  'unread-badge-background',
  'unread-badge-color',
  'overlay-backdrop',
  'overlay-shadow-color',
  'media-overlay-background',
  'media-overlay-hover-background',
  'media-overlay-strong-background',
  'media-overlay-foreground',
  'media-overlay-muted-foreground',
  'media-control-background',
  'media-control-hover-background',
  'media-control-foreground',
  'media-badge-background',
  'media-badge-foreground',
  'media-viewer-background',
  'media-viewer-border',
] as const;

export type ThemeTokenKey = (typeof themeTokenKeys)[number];
export type ThemeTokenOverrides = Partial<Record<ThemeTokenKey, string>>;

export type ThemeTokenGroup = 'surface' | 'text' | 'accent' | 'border' | 'state' | 'reader';

export const themeTokenGroups: Record<ThemeTokenGroup, readonly ThemeTokenKey[]> = {
  surface: [
    'bg-primary',
    'bg-secondary',
    'bg-tertiary',
    'surface-rail',
    'surface-panel',
    'surface-hover',
    'surface-selected',
    'overlay-backdrop',
    'overlay-shadow-color',
  ],
  text: ['text-primary', 'text-secondary', 'text-tertiary'],
  accent: [
    'accent-color',
    'accent-hover',
    'accent-text-color',
    'accent-foreground',
    'selection-background',
    'selection-color',
  ],
  border: ['border-color'],
  state: [
    'state-favorite-color',
    'state-favorite-background',
    'state-favorite-border',
    'state-read-later-color',
    'state-read-later-background',
    'state-read-later-border',
    'state-info-color',
    'state-info-background',
    'state-info-border',
    'state-success-color',
    'state-success-background',
    'state-success-border',
    'state-warning-color',
    'state-warning-background',
    'state-warning-border',
    'state-danger-color',
    'state-danger-background',
    'state-danger-border',
    'unread-badge-background',
    'unread-badge-color',
  ],
  reader: [
    'mark-bg-color',
    'table-stripe-color',
    'code-bg-color',
    'code-border-color',
    'syntax-plain',
    'syntax-comment',
    'syntax-keyword',
    'syntax-string',
    'syntax-title',
    'syntax-attribute',
    'syntax-meta',
    'syntax-built-in',
    'syntax-formula-background',
    'media-overlay-background',
    'media-overlay-hover-background',
    'media-overlay-strong-background',
    'media-overlay-foreground',
    'media-overlay-muted-foreground',
    'media-control-background',
    'media-control-hover-background',
    'media-control-foreground',
    'media-badge-background',
    'media-badge-foreground',
    'media-viewer-background',
    'media-viewer-border',
  ],
};

export interface CustomThemeProfile {
  id: string;
  name: string;
  basePreset: BuiltInThemePreset;
  appearance: 'light' | 'dark' | 'auto';
  light: ThemeTokenOverrides;
  dark: ThemeTokenOverrides;
  uiFontFamily: string;
  uiFontSize: number;
  updatedAt: string;
}

export interface ThemeProfilesDocument {
  version: 1;
  profiles: CustomThemeProfile[];
}

export interface ContrastCheck {
  foreground: string;
  background: string;
  ratio: number;
  passes: boolean;
}

export interface ThemeContrastReport {
  primary: ContrastCheck;
  secondary: ContrastCheck;
  accent: ContrastCheck;
  backgroundWarning: ContrastCheck;
  accentForeground: ContrastCheck;
  accentHover: ContrastCheck;
  selection: ContrastCheck;
  railSecondary: ContrastCheck;
  railAccent: ContrastCheck;
  panelPrimary: ContrastCheck;
  panelSecondary: ContrastCheck;
  panelAccent: ContrastCheck;
  panelWarning: ContrastCheck;
  hoverPrimary: ContrastCheck;
  hoverSecondary: ContrastCheck;
  hoverAccent: ContrastCheck;
  hoverWarning: ContrastCheck;
  selectedAccent: ContrastCheck;
  selectedSecondary: ContrastCheck;
  selectedWarning: ContrastCheck;
  unreadBadge: ContrastCheck;
  states: ContrastCheck[];
}
