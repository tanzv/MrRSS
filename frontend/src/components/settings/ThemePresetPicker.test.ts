import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import type { CustomThemeProfile } from '@/types/theme';
import ThemePresetPicker from './ThemePresetPicker.vue';

const themePickerSource = readFileSync(
  resolve(process.cwd(), 'src/components/settings/ThemePresetPicker.vue'),
  'utf8'
);
const themeStyles = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');
const previewTokenSources = {
  '--preview-canvas': '--bg-primary',
  '--preview-rail': '--surface-rail',
  '--preview-selected': '--surface-selected',
  '--preview-copy': '--text-primary',
  '--preview-muted': '--text-tertiary',
  '--preview-accent': '--accent-color',
} as const;
const previewPresets = ['paper', 'ink', 'sepia', 'high-contrast'] as const;

function cssBlock(source: string, selector: string): string {
  const selectorIndex = source.indexOf(selector);
  const blockStart = source.indexOf('{', selectorIndex);

  if (selectorIndex === -1 || blockStart === -1) {
    return '';
  }

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(blockStart + 1, index);
  }

  return '';
}

function cssVariable(block: string, variable: string): string {
  return block.match(new RegExp(`${variable}:\\s*([^;]+);`))?.[1]?.trim() ?? '';
}

const focusProfile: CustomThemeProfile = {
  id: 'focus',
  name: 'Focus',
  basePreset: 'paper',
  appearance: 'light',
  light: {},
  dark: {},
  uiFontFamily: 'system',
  uiFontSize: 16,
  updatedAt: '2026-08-23T00:00:00.000Z',
};

function mountPicker(modelValue = 'paper', profiles: CustomThemeProfile[] = []) {
  return mount(ThemePresetPicker, {
    props: { modelValue, profiles },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en },
        }),
      ],
    },
  });
}

describe('ThemePresetPicker', () => {
  it('renders all built-in choices with accessible selected state', () => {
    const wrapper = mountPicker();

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Theme');
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(5);
    expect(wrapper.get('[data-theme-option="paper"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[data-theme-option="paper"]').attributes('tabindex')).toBe('0');
    expect(wrapper.get('[data-theme-option="ink"]').attributes('aria-checked')).toBe('false');
    expect(wrapper.get('[data-theme-option="ink"]').attributes('tabindex')).toBe('-1');
  });

  it('emits the chosen built-in preset', async () => {
    const wrapper = mountPicker();

    await wrapper.get('[data-theme-option="sepia"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['sepia']]);
  });

  it('supports radio-group arrow-key navigation', async () => {
    const wrapper = mountPicker('paper');

    await wrapper.get('[data-theme-option="paper"]').trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['ink']]);
  });

  it('keeps an active custom profile inside the radio group and wraps keyboard navigation', async () => {
    const wrapper = mountPicker('custom:focus', [focusProfile]);
    const customOption = wrapper.find('[data-theme-option="custom:focus"]');

    expect(wrapper.findAll('[role="radio"]')).toHaveLength(6);
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
    expect(customOption.exists()).toBe(true);
    if (!customOption.exists()) return;
    expect(customOption.attributes('tabindex')).toBe('0');

    await customOption.trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['auto']]);
  });

  it('falls back to Auto when the persisted custom profile no longer exists', () => {
    const wrapper = mountPicker('custom:missing', [focusProfile]);

    expect(wrapper.get('[data-theme-option="auto"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
  });

  it('renders application-shell previews and shows both system bases for Auto', () => {
    const wrapper = mountPicker('auto', [focusProfile]);
    const autoPreview = wrapper.get('[data-theme-option="auto"] .theme-preset-preview');
    const autoShells = autoPreview.findAll('[data-theme-preview-shell]');

    expect(autoShells).toHaveLength(2);
    expect(autoShells.map((shell) => shell.attributes('data-theme-preview-shell'))).toEqual([
      'paper',
      'ink',
    ]);
    expect(autoPreview.findAll('.theme-preset-preview-rail')).toHaveLength(2);
    expect(autoPreview.findAll('.theme-preset-preview-content')).toHaveLength(2);
    expect(autoPreview.findAll('.theme-preset-preview-active')).toHaveLength(2);

    const paperPreview = wrapper.get('[data-theme-option="paper"] .theme-preset-preview');
    expect(paperPreview.findAll('[data-theme-preview-shell]')).toHaveLength(1);
    expect(paperPreview.get('[data-theme-preview-shell="paper"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-theme-option="custom:focus"] [data-theme-preview-shell="paper"]').exists()
    ).toBe(true);
    expect(wrapper.find('.theme-preset-preview-surface').exists()).toBe(false);
  });

  it('disables preview motion when reduced motion is requested', () => {
    expect(themePickerSource).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.theme-preset-option\s*\{[\s\S]*?transition:\s*none;/
    );
  });

  it.each(previewPresets)('keeps the %s preview colors aligned with its root palette', (preset) => {
    const rootSelector = preset === 'paper' ? ':root {' : `:root[data-theme-preset='${preset}'] {`;
    const rootPalette = cssBlock(themeStyles, rootSelector);
    const previewPalette = cssBlock(
      themePickerSource,
      `.theme-preset-preview-shell[data-theme-preview-shell='${preset}'] {`
    );

    for (const [previewToken, rootToken] of Object.entries(previewTokenSources)) {
      expect(cssVariable(previewPalette, previewToken)).toBe(cssVariable(rootPalette, rootToken));
    }
  });
});
