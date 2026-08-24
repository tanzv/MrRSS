import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import CustomThemeManager from './CustomThemeManager.vue';
import type { SettingsData } from '@/types/settings';
import { themeTokenKeys } from '@/types/theme';

const settingsFixture = {
  theme: 'paper',
  theme_profiles: '[]',
  content_font_family: 'serif',
  content_font_size: 22,
  content_line_height: '1.8',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
  ui_font_family: 'system',
  ui_font_size: 16,
} as unknown as SettingsData;

function mountManager(settings = settingsFixture) {
  return mount(CustomThemeManager, {
    props: { settings },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        FontFamilySelect: {
          props: ['modelValue'],
          template:
            '<select data-profile-font :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="system">system</option><option value="serif">serif</option></select>',
        },
        NumberControl: {
          props: ['modelValue'],
          template:
            '<input data-profile-size type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
        },
      },
    },
  });
}

function stubHighContrastTokens(): void {
  const baseTokens = Object.fromEntries(themeTokenKeys.map((key) => [`--${key}`, '#000000']));
  Object.assign(baseTokens, {
    '--text-primary': '#ffffff',
    '--text-secondary': '#ffffff',
    '--accent-text-color': '#ffffff',
    '--accent-color': '#ffe600',
    '--accent-hover': '#fff36d',
    '--accent-foreground': '#000000',
    '--selection-background': '#ffe600',
    '--selection-color': '#000000',
    '--unread-badge-background': '#ffe600',
    '--unread-badge-color': '#000000',
    '--state-favorite-color': '#ffffff',
    '--state-favorite-background': '#000000',
    '--state-read-later-color': '#ffffff',
    '--state-read-later-background': '#000000',
    '--state-info-color': '#ffffff',
    '--state-info-background': '#000000',
    '--state-success-color': '#ffffff',
    '--state-success-background': '#000000',
    '--state-warning-color': '#ffffff',
    '--state-warning-background': '#000000',
    '--state-danger-color': '#ffffff',
    '--state-danger-background': '#000000',
  });
  vi.stubGlobal(
    'getComputedStyle',
    () =>
      ({
        getPropertyValue: (name: string) => baseTokens[name] ?? '#000000',
      }) as CSSStyleDeclaration
  );
}

function stubPaperTokens(): void {
  const baseTokens = Object.fromEntries(themeTokenKeys.map((key) => [`--${key}`, '#ffffff']));
  Object.assign(baseTokens, {
    '--text-primary': '#000000',
    '--text-secondary': '#000000',
    '--accent-text-color': '#005fcc',
    '--accent-color': '#005fcc',
    '--accent-hover': '#004caa',
    '--accent-foreground': '#ffffff',
    '--selection-background': '#005fcc',
    '--selection-color': '#ffffff',
    '--unread-badge-background': '#005fcc',
    '--unread-badge-color': '#ffffff',
    '--state-favorite-color': '#000000',
    '--state-favorite-background': '#ffffff',
    '--state-read-later-color': '#000000',
    '--state-read-later-background': '#ffffff',
    '--state-info-color': '#000000',
    '--state-info-background': '#ffffff',
    '--state-success-color': '#000000',
    '--state-success-background': '#ffffff',
    '--state-warning-color': '#000000',
    '--state-warning-background': '#ffffff',
    '--state-danger-color': '#000000',
    '--state-danger-background': '#ffffff',
  });
  vi.stubGlobal(
    'getComputedStyle',
    () =>
      ({
        getPropertyValue: (name: string) => baseTokens[name] ?? '#ffffff',
      }) as CSSStyleDeclaration
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomThemeManager', () => {
  it('renders an accessible empty state and creates a profile', async () => {
    const wrapper = mountManager();

    expect(wrapper.get('[data-theme-manager]').exists()).toBe(true);
    expect(wrapper.get('[data-action="new-theme"]').attributes('aria-label')).toBeTruthy();
    await wrapper.get('[data-action="new-theme"]').trigger('click');

    const emitted = wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData;
    expect(JSON.parse(emitted.theme_profiles)).toHaveLength(1);
    expect(emitted.theme.startsWith('custom:')).toBe(true);
  });

  it('updates a token while keeping reader typography untouched', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');
    await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#ff5500');

    const emitted = wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData;
    const profiles = JSON.parse(emitted.theme_profiles);
    expect(profiles[0].light['accent-color']).toBe('#ff5500');
    expect(emitted.content_font_family).toBe(settingsFixture.content_font_family);
    expect(emitted.content_font_size).toBe(settingsFixture.content_font_size);
  });

  it('switches variants, resets one token, duplicates, and deletes profiles', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');
    await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#ff5500');
    await wrapper.get('[data-variant="dark"]').trigger('click');
    await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#00aa88');

    let profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles[0].dark['accent-color']).toBe('#00aa88');
    await wrapper.get('[data-token="accent-color"] [data-action="reset-token"]').trigger('click');
    profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles[0].dark['accent-color']).toBeUndefined();

    await wrapper.get('[data-action="duplicate-theme"]').trigger('click');
    profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles).toHaveLength(2);

    await wrapper.get('[data-action="delete-theme"]').trigger('click');
    profiles = JSON.parse(
      (wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData).theme_profiles
    );
    expect(profiles).toHaveLength(1);
  });

  it('exposes separate appearance controls and token groups', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');

    expect(wrapper.get('[role="radiogroup"][data-appearance-group]').exists()).toBe(true);
    expect(wrapper.get('[role="tablist"][data-variant-tabs]').exists()).toBe(true);
    expect(wrapper.get('[data-token-group="surface"]').exists()).toBe(true);
    expect(wrapper.get('[data-token="overlay-shadow-color"]').exists()).toBe(true);
    expect(wrapper.get('[data-token-group="reader"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-contrast-status] [role="listitem"]')).toHaveLength(27);
  });

  it('keeps the current profiles when an import document is invalid', async () => {
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');
    const input = wrapper.get('input[type="file"]');
    const invalidFile = new File(
      [JSON.stringify({ version: 1, profiles: [{ id: 'broken' }] })],
      'broken.json',
      { type: 'application/json' }
    );
    Object.defineProperty(input.element, 'files', { value: [invalidFile] });

    await input.trigger('change');
    await flushPromises();

    const latest = wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData;
    expect(JSON.parse(latest.theme_profiles)).toHaveLength(1);
  });

  it('keeps the active profile selected after rejecting a contrast-invalid import', async () => {
    stubHighContrastTokens();
    const wrapper = mountManager();
    await wrapper.get('[data-action="new-theme"]').trigger('click');
    const emittedCount = wrapper.emitted('update:settings')?.length ?? 0;
    const input = wrapper.get('input[type="file"]');
    const rejectedFile = new File(
      [
        JSON.stringify({
          version: 1,
          profiles: [
            {
              id: 'transparent-high-contrast',
              name: 'Transparent high contrast',
              basePreset: 'high-contrast',
              appearance: 'light',
              light: {
                'accent-color': '#00000000',
                'accent-foreground': '#000000',
              },
              dark: {},
              uiFontFamily: 'system',
              uiFontSize: 16,
              updatedAt: '2026-08-23T00:00:00.000Z',
            },
          ],
        }),
      ],
      'transparent-high-contrast.json',
      { type: 'application/json' }
    );
    Object.defineProperty(input.element, 'files', { value: [rejectedFile] });

    await input.trigger('change');
    await flushPromises();

    expect(wrapper.emitted('update:settings') ?? []).toHaveLength(emittedCount);
    expect(wrapper.get('[data-token-group="accent"]').exists()).toBe(true);
    expect(wrapper.get('[data-profile-id]').classes()).toContain('is-selected');
  });

  it('restores a rejected high-contrast token edit instead of leaving an unsaved draft', async () => {
    stubHighContrastTokens();
    const settings = {
      ...settingsFixture,
      theme: 'custom:contrast-check',
      theme_profiles: JSON.stringify([
        {
          id: 'contrast-check',
          name: 'Contrast check',
          basePreset: 'high-contrast',
          appearance: 'light',
          light: {},
          dark: {},
          uiFontFamily: 'system',
          uiFontSize: 16,
          updatedAt: '2026-08-23T00:00:00.000Z',
        },
      ]),
    } as SettingsData;
    const wrapper = mountManager(settings);

    await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#ffffff');
    const hover = wrapper.get('[data-token="accent-hover"] input[type="text"]');
    await hover.setValue('#123');
    const emittedCount = wrapper.emitted('update:settings')?.length ?? 0;
    const foreground = wrapper.get('[data-token="accent-foreground"] input[type="text"]');

    await foreground.setValue('#ffffff');

    expect(wrapper.emitted('update:settings')).toHaveLength(emittedCount);
    expect((foreground.element as HTMLInputElement).value).toBe('');
    expect((hover.element as HTMLInputElement).value).toBe('#123');
  });

  it('restores a rejected paper token edit instead of allowing unreadable sidebar text', async () => {
    stubPaperTokens();
    const settings = {
      ...settingsFixture,
      theme: 'custom:paper-contrast',
      theme_profiles: JSON.stringify([
        {
          id: 'paper-contrast',
          name: 'Paper contrast',
          basePreset: 'paper',
          appearance: 'light',
          light: {},
          dark: {},
          uiFontFamily: 'system',
          uiFontSize: 16,
          updatedAt: '2026-08-23T00:00:00.000Z',
        },
      ]),
    } as SettingsData;
    const wrapper = mountManager(settings);
    const emittedCount = wrapper.emitted('update:settings')?.length ?? 0;
    const text = wrapper.get('[data-token="text-secondary"] input[type="text"]');

    await text.setValue('#ffffff');

    expect(wrapper.emitted('update:settings') ?? []).toHaveLength(emittedCount);
    expect((text.element as HTMLInputElement).value).toBe('');
  });
});
