# Reader Appearance Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused, responsive Aa reader appearance panel with six meaningful typography styles, immediate previews, and reliable global persistence.

**Architecture:** Keep the existing five content typography settings as the single persisted source of truth. Extend the pure reader typography model with Magazine, add an article-scoped persistence composable that updates the shared settings ref and batches the existing /api/settings payload, then compose it from an Aa panel owned by the always-mounted article toolbar. The application theme remains the only owner of color tokens; Magazine adds only typography and header rhythm.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Pinia, vue-i18n, Tailwind CSS, existing semantic CSS variables, Vitest, Vue Test Utils, Go tests, Wails v3.

## Global Constraints

- Preserve content_font_family, content_font_size, content_line_height, content_width, and content_paragraph_spacing as the only persisted reader-appearance values.
- Do not add schema fields, backend handlers, database migrations, package dependencies, font downloads, or new network endpoints.
- Show Aa only while RSS content is visible in active reading mode. Existing reading-mode entry must continue to focus the article scroll region.
- Theme selection controls semantic colors and contrast only. Selecting or switching themes must never overwrite any of the five reader typography values.
- Magazine may change the article title and metadata rhythm only while active reading mode resolves to magazine; it must not generate imagery, alter article media, or add a color palette.
- Add every new user-facing string to both frontend/src/i18n/locales/en.ts and frontend/src/i18n/locales/zh.ts.
- Preserve unrelated dirty working-tree changes. Stage only files named in the current task; never use broad staging, reset, checkout, clean, or destructive commands.
- Write each specified test first, observe its failure, then implement the smallest code that makes it pass.
- Before handoff, run focused frontend tests, the complete frontend unit suite, frontend production build, go test -v -timeout=5m ./..., wails3 build, browser acceptance, and git diff --check.

---

## File Structure

- frontend/src/utils/readerTypography.ts: Pure preset definitions, normalization, matching, and theme recommendation mapping.
- frontend/src/utils/readerTypography.test.ts: Magazine values, complete-match behavior, and recommendation coverage.
- frontend/src/components/settings/ReaderTypographyPresetPicker.vue: Shared accessible style radio group with full settings and compact reader-panel presentations.
- frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts: Six-style rendering, compact presentation, selection, and keyboard behavior.
- frontend/src/components/modals/settings/reading/TypographySettings.test.ts: Regression coverage proving Magazine flows through the existing full settings update path.
- frontend/src/composables/article/useReaderTypographyPreferences.ts: Shared-settings updates, debounced saving, flush, retry, and save-error state.
- frontend/src/composables/article/useReaderTypographyPreferences.test.ts: Deterministic fake-timer coverage for local preview, batching, flush, error, and retry.
- frontend/src/components/article/ReaderAppearancePanel.vue: Teleported desktop popover and mobile bottom-sheet content, controls, focus behavior, and semantic styling.
- frontend/src/components/article/ReaderAppearancePanel.test.ts: Desktop/mobile presentation, control payloads, focus behavior, responsive hiding, and error retry UI.
- frontend/src/components/article/ArticleToolbar.vue: Reader-only Aa trigger, panel ownership, persistence wiring, and focus restoration.
- frontend/src/components/article/ArticleToolbar.test.ts: Trigger visibility, ARIA state, close/return-focus behavior, and unchanged reading controls.
- frontend/src/components/article/ArticleDetail.vue: Supplies the toolbar with whether RSS body content is currently readable.
- frontend/src/components/article/ArticleDetail.test.ts: Ensures the appearance trigger cannot become available before rendered RSS body content exists.
- frontend/src/components/article/ArticleContent.vue: Resolves the current reader style and exposes it as a readonly reader-column attribute.
- frontend/src/components/article/ArticleContent.test.ts: Verifies Magazine state reaches the article column and title only in reading mode.
- frontend/src/components/article/parts/ArticleTitle.vue: Applies the limited Magazine title and metadata rhythm using inherited reader typography variables.
- frontend/src/components/article/parts/ArticleTitle.test.ts: Covers Magazine and neutral-title rendering.
- frontend/src/i18n/locales/en.ts and frontend/src/i18n/locales/zh.ts: Names, descriptions, control labels, error feedback, and accessible names.

### Task 1: Add the Magazine Style to the Shared Typography Model

**Files:**
- Modify: frontend/src/utils/readerTypography.ts
- Modify: frontend/src/utils/readerTypography.test.ts
- Modify: frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts
- Modify: frontend/src/components/modals/settings/reading/TypographySettings.test.ts
- Modify: frontend/src/i18n/locales/en.ts
- Modify: frontend/src/i18n/locales/zh.ts

**Interfaces:**
- Consumes: ReaderTypographyValues and the existing five-field complete-match rule.
- Produces: ReaderTypographyPresetId = 'focus' | 'magazine' | 'night' | 'book' | 'clarity' | 'compact'.
- Produces: a magazine ReaderTypographyPreset with { content_font_family: 'serif', content_font_size: 17, content_line_height: '1.7', content_width: 'comfortable', content_paragraph_spacing: 'comfortable' }.
- Preserves: readerThemePresetMap; Magazine and Compact remain unbound to an app theme.

- [ ] **Step 1: Write failing utility, picker, and settings-path tests**

~~~ts
it('recognizes Magazine only when all five of its explicit values match', () => {
  const magazine = readerTypographyPresets.find((preset) => preset.id === 'magazine');

  expect(magazine?.values).toEqual({
    content_font_family: 'serif',
    content_font_size: 17,
    content_line_height: '1.7',
    content_width: 'comfortable',
    content_paragraph_spacing: 'comfortable',
  });
  expect(getReaderTypographyPreset(magazine?.values ?? {})).toBe('magazine');
  expect(getReaderTypographyPreset({ ...magazine?.values, content_font_size: 18 })).toBe('custom');
  expect(getRecommendedReaderTypographyPreset('paper').id).toBe('focus');
});

it('renders Magazine as the sixth accessible style and emits its complete values', async () => {
  const wrapper = mountPicker();

  expect(wrapper.findAll('[role="radio"]')).toHaveLength(6);
  await wrapper.get('[data-reader-preset="magazine"]').trigger('click');
  expect(wrapper.emitted('select')?.[0]).toEqual([
    {
      content_font_family: 'serif',
      content_font_size: 17,
      content_line_height: '1.7',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
    },
  ]);
});

it('writes the complete Magazine values through the existing settings update event', async () => {
  const wrapper = mount(TypographySettings, {
    props: { settings: createSettings() },
    global: {
      plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });

  await wrapper.get('[data-reader-preset="magazine"]').trigger('click');
  expect(wrapper.emitted('update:settings')?.[0]?.[0]).toMatchObject({
    content_font_family: 'serif',
    content_font_size: 17,
    content_line_height: '1.7',
    content_width: 'comfortable',
    content_paragraph_spacing: 'comfortable',
  });
});
~~~

- [ ] **Step 2: Run the focused tests and verify they fail because Magazine is absent**

Run:

~~~bash
cd frontend && npm run test:unit -- src/utils/readerTypography.test.ts src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/modals/settings/reading/TypographySettings.test.ts
~~~

Expected: FAIL because magazine is not a valid preset id, no matching radio exists, and no localized Magazine label exists.

- [ ] **Step 3: Add the sixth preset and its translations without changing theme mapping**

~~~ts
export type ReaderTypographyPresetId =
  | 'focus'
  | 'magazine'
  | 'night'
  | 'book'
  | 'clarity'
  | 'compact';

{
  id: 'magazine',
  values: {
    content_font_family: 'serif',
    content_font_size: 17,
    content_line_height: '1.7',
    content_width: 'comfortable',
    content_paragraph_spacing: 'comfortable',
  },
},
~~~

Add setting.typography.readerPresetMagazine and setting.typography.readerPresetMagazineDesc as Magazine / Editorial rhythm for feature stories in English and 杂志 / 适合深度报道与专题文章的编辑式节奏 in Simplified Chinese. Do not add magazine to readerThemePresetMap.

- [ ] **Step 4: Run the focused tests and verify the complete-match contract passes**

Run:

~~~bash
cd frontend && npm run test:unit -- src/utils/readerTypography.test.ts src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/modals/settings/reading/TypographySettings.test.ts
~~~

Expected: PASS; the settings page keeps its current cards, now containing six options, and a one-field change resolves to custom.

- [ ] **Step 5: Run targeted lint and commit only Task 1 files**

Run:

~~~bash
cd frontend && npx eslint src/utils/readerTypography.ts src/utils/readerTypography.test.ts src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/modals/settings/reading/TypographySettings.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts
git add -- frontend/src/utils/readerTypography.ts frontend/src/utils/readerTypography.test.ts frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts frontend/src/components/modals/settings/reading/TypographySettings.test.ts frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/zh.ts
git commit -m "feat(reader): add magazine typography style"
~~~

Expected: ESLint exits with code 0 and the commit contains only the Task 1 paths.

### Task 2: Add Reliable Reader-Typography Persistence

**Files:**
- Create: frontend/src/composables/article/useReaderTypographyPreferences.ts
- Create: frontend/src/composables/article/useReaderTypographyPreferences.test.ts
- Modify: frontend/src/i18n/locales/en.ts
- Modify: frontend/src/i18n/locales/zh.ts

**Interfaces:**
- Consumes: Ref<SettingsData>, buildAutoSavePayload(settings), getRecommendedReaderTypographyPreset(theme), and ReaderTypographyValues.
- Produces:

~~~ts
export interface ReaderTypographyPreferences {
  settings: Ref<SettingsData>;
  isSaving: Readonly<Ref<boolean>>;
  saveError: Readonly<Ref<boolean>>;
  updateTypography: (patch: Partial<ReaderTypographyValues>) => void;
  applyPreset: (values: ReaderTypographyValues) => void;
  applyThemeRecommendation: (theme: unknown) => void;
  flushSave: () => Promise<void>;
  retrySave: () => Promise<void>;
}

export interface ReaderTypographyPreferencesOptions {
  settings?: Ref<SettingsData>;
  debounceMs?: number;
  request?: (payload: Record<string, string>) => Promise<Response>;
}

export function useReaderTypographyPreferences(
  options?: ReaderTypographyPreferencesOptions
): ReaderTypographyPreferences;
~~~

- [ ] **Step 1: Write failing fake-timer tests for preview, batching, flush, and retry**

~~~ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { generateInitialSettings } from '@/composables/core/useSettings.generated';
import en from '@/i18n/locales/en';
import type { ReaderTypographyValues } from '@/utils/readerTypography';
import {
  useReaderTypographyPreferences,
  type ReaderTypographyPreferences,
  type ReaderTypographyPreferencesOptions,
} from './useReaderTypographyPreferences';

const magazineValues: ReaderTypographyValues = {
  content_font_family: 'serif',
  content_font_size: 17,
  content_line_height: '1.7',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
};

function mountPreferences(options: ReaderTypographyPreferencesOptions = {}) {
  const settings = options.settings ?? ref({ ...generateInitialSettings() });
  let preferences!: ReaderTypographyPreferences;
  const wrapper = mount(
    defineComponent({
      setup() {
        preferences = useReaderTypographyPreferences({ ...options, settings });
        return () => h('div');
      },
    }),
    { global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] } }
  );
  return { wrapper, preferences, settings };
}

it('updates shared typography synchronously and saves one complete payload after 500ms', async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({ ok: true } as Response);
  const { preferences, settings } = mountPreferences({ request, debounceMs: 500 });

  preferences.updateTypography({ content_font_size: 19 });
  preferences.updateTypography({ content_width: 'narrow' });

  expect(settings.value.content_font_size).toBe(19);
  expect(settings.value.content_width).toBe('narrow');
  await vi.advanceTimersByTimeAsync(499);
  expect(request).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({ content_font_size: '19', content_width: 'narrow' })
  );
});

it('flushes a pending update and keeps the preview while exposing an error and retrying', async () => {
  const showToast = vi.spyOn(window, 'showToast');
  const request = vi
    .fn()
    .mockResolvedValueOnce({ ok: false } as Response)
    .mockResolvedValueOnce({ ok: true } as Response);
  const { preferences, settings } = mountPreferences({ request, debounceMs: 500 });

  preferences.applyPreset(magazineValues);
  await preferences.flushSave();
  expect(settings.value.content_font_size).toBe(17);
  expect(preferences.saveError.value).toBe(true);
  expect(showToast).toHaveBeenCalledWith('Could not save reading appearance', 'error');

  await preferences.retrySave();
  expect(preferences.saveError.value).toBe(false);
  expect(request).toHaveBeenCalledTimes(2);
});

it('applies the current theme recommendation only when the restore command is invoked', () => {
  const { preferences, settings } = mountPreferences({ debounceMs: 500 });

  preferences.applyThemeRecommendation('sepia');

  expect(settings.value).toMatchObject({
    content_font_family: 'serif',
    content_font_size: 18,
    content_line_height: '1.8',
    content_width: 'narrow',
    content_paragraph_spacing: 'relaxed',
  });
});

afterEach(() => vi.useRealTimers());
~~~

- [ ] **Step 2: Run the focused composable test and verify it fails because the module is absent**

Run:

~~~bash
cd frontend && npm run test:unit -- src/composables/article/useReaderTypographyPreferences.test.ts
~~~

Expected: FAIL with a module-resolution error for useReaderTypographyPreferences.

- [ ] **Step 3: Implement the composable around the shared settings ref and existing payload builder**

~~~ts
function defaultRequest(payload: Record<string, string>): Promise<Response> {
  return fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function updateTypography(patch: Partial<ReaderTypographyValues>): void {
  settings.value = { ...settings.value, ...patch };
  dirty = true;
  scheduleSave();
}

function applyThemeRecommendation(theme: unknown): void {
  updateTypography(getRecommendedReaderTypographyPreset(theme).values);
}
~~~

Use useSettings().settings when options.settings is not supplied. Generate every request with buildAutoSavePayload(settings) so all unchanged settings remain present. Treat a non-OK response and a rejected request identically: retain the local preview, keep the pending state dirty, set saveError, call window.showToast(t('article.readingMode.appearanceSaveFailed'), 'error'), and do not dispatch a successful autosave event. On a successful request, clear saveError and dispatch new CustomEvent('settings-updated', { detail: { autoSave: true } }).

Serialize saves so an update made while a request is in flight is persisted by a following request. flushSave clears the timer and awaits the latest dirty payload; retrySave invokes the same path immediately even when no timer is pending.

Add article.readingMode.appearanceSaveFailed as Could not save reading appearance in English and 无法保存阅读外观。 in Simplified Chinese before running this task's error-path test.

- [ ] **Step 4: Run the focused composable tests and verify event and error behavior**

Run:

~~~bash
cd frontend && npm run test:unit -- src/composables/article/useReaderTypographyPreferences.test.ts
~~~

Expected: PASS; no request is sent before the debounce deadline, close-time flushing sends the latest full payload, failure does not revert settings, and retry clears the error after a successful response.

- [ ] **Step 5: Run targeted lint and commit only Task 2 files**

Run:

~~~bash
cd frontend && npx eslint src/composables/article/useReaderTypographyPreferences.ts src/composables/article/useReaderTypographyPreferences.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts
git add -- frontend/src/composables/article/useReaderTypographyPreferences.ts frontend/src/composables/article/useReaderTypographyPreferences.test.ts frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/zh.ts
git commit -m "feat(reader): persist appearance changes"
~~~

Expected: ESLint exits with code 0 and the commit contains only the composable and its test.

### Task 3: Build the Responsive Aa Appearance Panel

**Files:**
- Modify: frontend/src/components/settings/ReaderTypographyPresetPicker.vue
- Modify: frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts
- Create: frontend/src/components/article/ReaderAppearancePanel.vue
- Create: frontend/src/components/article/ReaderAppearancePanel.test.ts
- Modify: frontend/src/i18n/locales/en.ts
- Modify: frontend/src/i18n/locales/zh.ts

**Interfaces:**
- ReaderTypographyPresetPicker gains variant?: 'settings' | 'compact', defaulting to 'settings'; its existing select: [ReaderTypographyValues] event and radio-group keyboard behavior remain unchanged.
- ReaderAppearancePanel consumes anchor: HTMLElement | null, settings: ReaderTypographyInput, themePreset?: ThemePreset, and saveError?: boolean.
- ReaderAppearancePanel emits close, select-preset: [ReaderTypographyValues], update-typography: [Partial<ReaderTypographyValues>], restore-theme-recommendation, and retry-save.

- [ ] **Step 1: Write failing picker-variant and panel interaction tests**

~~~ts
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import type { ReaderTypographyInput } from '@/utils/readerTypography';
import FontFamilySelect from '@/components/settings/FontFamilySelect.vue';
import ReaderAppearancePanel from './ReaderAppearancePanel.vue';

const focusSettings: ReaderTypographyInput = {
  content_font_family: 'system',
  content_font_size: 16,
  content_line_height: '1.6',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
};

function mockAppearanceMedia(mobile: boolean): void {
  window.matchMedia = vi.fn(() => ({
    matches: mobile,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function mountPanel(options: {
  mobile: boolean;
  settings: ReaderTypographyInput;
  saveError?: boolean;
}) {
  mockAppearanceMedia(options.mobile);
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () => new DOMRect(360, 12, 44, 44);
  document.body.append(anchor);
  return mount(ReaderAppearancePanel, {
    attachTo: document.body,
    props: {
      anchor,
      settings: options.settings,
      themePreset: 'paper',
      saveError: options.saveError ?? false,
    },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
}

function mountPicker(
  settings = focusSettings,
  themePreset: ThemePreset = 'paper',
  extraProps: { variant?: 'settings' | 'compact' } = {}
) {
  return mount(ReaderTypographyPresetPicker, {
    props: { settings, themePreset, ...extraProps },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
}

it('renders the shared radio group in compact mode without losing selection semantics', () => {
  const wrapper = mountPicker(focusSettings, 'paper', { variant: 'compact' });

  expect(wrapper.get('[role="radiogroup"]').classes()).toContain('reader-typography-preset-picker--compact');
  expect(wrapper.get('[data-reader-preset="focus"]').attributes('aria-checked')).toBe('true');
});

it('emits precise typography patches from desktop controls', async () => {
  const wrapper = mountPanel({ mobile: false, settings: focusSettings });

  await wrapper.get('[data-testid="reader-font-increase"]').trigger('click');
  await wrapper.get('[data-testid="reader-density-relaxed"]').trigger('click');
  await wrapper.get('[data-testid="reader-width-narrow"]').trigger('click');

  expect(wrapper.emitted('update-typography')).toEqual([
    [{ content_font_size: 17 }],
    [{ content_line_height: '1.8', content_paragraph_spacing: 'relaxed' }],
    [{ content_width: 'narrow' }],
  ]);
});

it('forwards a font-family selection as a typography patch', () => {
  const wrapper = mountPanel({ mobile: false, settings: focusSettings });

  wrapper.findComponent(FontFamilySelect).vm.$emit('update:modelValue', 'serif');
  expect(wrapper.emitted('update-typography')).toEqual([[{ content_font_family: 'serif' }]]);
});

it('disables font-size endpoints and exposes explicit restore and retry commands', async () => {
  const min = mountPanel({
    mobile: false,
    settings: { ...focusSettings, content_font_size: 10 },
  });
  expect(min.get('[data-testid="reader-font-decrease"]').attributes('disabled')).toBeDefined();

  const max = mountPanel({
    mobile: false,
    settings: { ...focusSettings, content_font_size: 24 },
    saveError: true,
  });
  expect(max.get('[data-testid="reader-font-increase"]').attributes('disabled')).toBeDefined();
  await max.get('[data-testid="reader-appearance-restore"]').trigger('click');
  await max.get('[data-testid="reader-appearance-retry"]').trigger('click');
  expect(max.emitted('restore-theme-recommendation')).toEqual([[]]);
  expect(max.emitted('retry-save')).toEqual([[]]);
});

it('uses a mobile dialog, hides width, traps focus, and closes on Escape', async () => {
  const wrapper = mountPanel({ mobile: true, settings: focusSettings });

  expect(wrapper.get('[data-testid="reader-appearance-sheet"]').attributes('aria-modal')).toBe('true');
  expect(wrapper.find('[data-testid="reader-width-control"]').exists()).toBe(false);
  const controls = wrapper.findAll('button:not([disabled])');
  controls.at(-1)?.element.focus();
  controls.at(-1)?.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  await nextTick();
  expect(document.activeElement).toBe(controls[0].element);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(wrapper.emitted('close')).toEqual([[]]);
});

it('closes a desktop popover when a pointer starts outside its anchor and panel', async () => {
  const wrapper = mountPanel({ mobile: false, settings: focusSettings });
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  await nextTick();
  expect(wrapper.emitted('close')).toEqual([[]]);
});
~~~

- [ ] **Step 2: Run the panel and picker tests and verify they fail before component creation**

Run:

~~~bash
cd frontend && npm run test:unit -- src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/article/ReaderAppearancePanel.test.ts
~~~

Expected: FAIL because the compact variant and reader appearance panel do not exist.

- [ ] **Step 3: Make the style picker reusable in compact presentation**

~~~ts
interface Props {
  settings: ReaderTypographyInput;
  themePreset?: ThemePreset;
  variant?: 'settings' | 'compact';
}

const props = withDefaults(defineProps<Props>(), {
  themePreset: 'paper',
  variant: 'settings',
});
~~~

Keep the existing radiogroup, arrow-key, Home, End, selected-style, Custom-state, and theme-recommendation behavior. For compact, render the same six radio choices in one responsive list with their short descriptions; apply reader-typography-preset-picker--compact and avoid the large settings-card spacing. The full settings page continues to use the current two-column card presentation.

- [ ] **Step 4: Implement the teleported popover and bottom sheet with exact controls**

~~~ts
const densityValues = {
  compact: { content_line_height: '1.5', content_paragraph_spacing: 'compact' },
  balanced: { content_line_height: '1.6', content_paragraph_spacing: 'comfortable' },
  relaxed: { content_line_height: '1.8', content_paragraph_spacing: 'relaxed' },
} as const satisfies Record<string, Partial<ReaderTypographyValues>>;

function changeFontSize(delta: -1 | 1): void {
  const current = normalizeReaderTypography(props.settings).content_font_size;
  const next = Math.min(24, Math.max(10, current + delta));
  if (next !== current) emit('update-typography', { content_font_size: next });
}
~~~

Render the panel through Teleport to body. At (max-width: 639px), render a bottom-sheet role="dialog" with aria-modal="true", a visible close button, overlay click handling, body-scroll restoration, and a Tab loop within the sheet. At wider sizes, render a non-modal role="dialog" popover with aria-modal omitted. Anchor it with position: fixed from anchor.getBoundingClientRect(), constrain it within an 8px viewport margin, and update its position on window resize and capture-phase scroll.

The panel renders, in order:

1. ReaderTypographyPresetPicker using variant="compact" and forwarding its complete preset payload.
2. A-, current N px, and A+ buttons with data-testid="reader-font-decrease" and data-testid="reader-font-increase"; disable the endpoint button at 10px or 24px.
3. Existing FontFamilySelect bound to settings.content_font_family, forwarding { content_font_family: value }.
4. Compact, Balanced, and Relaxed density buttons using the exact densityValues pairs.
5. Narrow, Comfortable, and Wide width buttons only at desktop size.
6. A localized restore command that emits restore-theme-recommendation and a localized retry button shown only for saveError that emits retry-save.

Install one Escape handler for the active panel. Desktop outside-pointer handling must ignore both the panel and anchor; mobile overlay clicks close only when the event target is the overlay. After mounting, focus the first interactive panel control. The toolbar owns focus return after receiving close.

Add these messages under article.readingMode in both locales: appearance, appearanceTitle, appearanceClose, appearanceFontSize, appearanceDecreaseFontSize, appearanceIncreaseFontSize, appearanceDensity, appearanceDensityCompact, appearanceDensityBalanced, appearanceDensityRelaxed, appearanceWidth, appearanceUseThemeStyle, and appearanceRetrySave.

- [ ] **Step 5: Run panel tests and verify desktop/mobile accessibility behavior**

Run:

~~~bash
cd frontend && npm run test:unit -- src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/article/ReaderAppearancePanel.test.ts
~~~

Expected: PASS; all patch payloads are exact, typography endpoints disable correctly, desktop uses a popover, mobile uses a focus-contained sheet with no width control, and error state exposes a retry command.

- [ ] **Step 6: Run targeted lint and commit only Task 3 files**

Run:

~~~bash
cd frontend && npx eslint src/components/settings/ReaderTypographyPresetPicker.vue src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/article/ReaderAppearancePanel.vue src/components/article/ReaderAppearancePanel.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts
git add -- frontend/src/components/settings/ReaderTypographyPresetPicker.vue frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts frontend/src/components/article/ReaderAppearancePanel.vue frontend/src/components/article/ReaderAppearancePanel.test.ts frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/zh.ts
git commit -m "feat(reader): add appearance panel"
~~~

Expected: ESLint exits with code 0 and the commit contains only the reader panel, shared picker, locale, and test paths listed above.

### Task 4: Integrate Aa with the Reading Toolbar and Magazine Header Rhythm

**Files:**
- Modify: frontend/src/components/article/ArticleToolbar.vue
- Modify: frontend/src/components/article/ArticleToolbar.test.ts
- Modify: frontend/src/components/article/ArticleDetail.vue
- Modify: frontend/src/components/article/ArticleDetail.test.ts
- Modify: frontend/src/components/article/ArticleContent.vue
- Modify: frontend/src/components/article/ArticleContent.test.ts
- Modify: frontend/src/components/article/parts/ArticleTitle.vue
- Create: frontend/src/components/article/parts/ArticleTitle.test.ts

**Interfaces:**
- ArticleToolbar owns isReaderAppearanceOpen, appearanceTrigger, and one useReaderTypographyPreferences({ settings }) instance; it maps every ReaderAppearancePanel event to the named composable method.
- ArticleToolbar accepts hasReaderContent?: boolean and only renders Aa when showContent, isReadingMode, and hasReaderContent are all true.
- ArticleDetail computes hasReaderContent from a nonempty articleContent value and a false isLoadingContent value, then passes it to ArticleToolbar.
- ArticleContent exposes data-reader-style="focus | magazine | night | book | clarity | compact | custom" on [data-testid="article-reading-column"].
- ArticleTitle gains readerStyle?: ReaderTypographyPresetId | 'custom', defaulting to 'custom'.

- [ ] **Step 1: Write failing toolbar, reader-column, and title-rhythm tests**

~~~ts
function mountTitle(readerStyle: ReaderTypographyPresetId | 'custom') {
  const titleArticle: Article = {
    id: 1,
    feed_id: 1,
    title: 'Example article',
    url: 'https://example.com/article',
    published_at: '2026-08-23T00:00:00Z',
    is_read: false,
    is_favorite: false,
    is_hidden: false,
    is_read_later: false,
  };
  return mount(ArticleTitle, {
    props: {
      article: titleArticle,
      translatedTitle: '',
      isTranslatingTitle: false,
      translationEnabled: false,
      readerStyle,
    },
    global: {
      plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

async function mountArticleDetailWithToolbarStub(content: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ content, cached: true }),
    })
  );
  const pinia = createPinia();
  const wrapper = mount(ArticleDetail, {
    global: {
      plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        ArticleToolbar: { name: 'ArticleToolbar', props: ['hasReaderContent'], template: '<div />' },
        ArticleContent: true,
        ImageViewer: true,
        FindInPage: true,
      },
    },
  });
  const store = useAppStore(pinia);
  store.articles = [article];
  store.articleViewModePreferences.set(article.id, 'rendered');
  store.currentArticleId = article.id;
  await nextTick();
  await flushPromises();
  return wrapper;
}

function mountToolbar(
  props: {
    showContent?: boolean;
    isReadingMode?: boolean;
    readingProgress?: number;
    hasReaderContent?: boolean;
  } = {}
) {
  return mount(ArticleToolbar, {
    props: { article, showContent: false, ...props },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
}

it('shows an expanded-state appearance trigger only in active reading mode and restores focus on close', async () => {
  const wrapper = mountToolbar({ showContent: true, isReadingMode: true, hasReaderContent: true });
  const trigger = wrapper.get('[data-testid="reader-appearance-trigger"]');

  expect(trigger.attributes('aria-expanded')).toBe('false');
  await trigger.trigger('click');
  expect(trigger.attributes('aria-expanded')).toBe('true');
  wrapper.getComponent(ReaderAppearancePanel).vm.$emit('close');
  await nextTick();
  expect(document.activeElement).toBe(trigger.element);

  await wrapper.setProps({ isReadingMode: false });
  expect(wrapper.find('[data-testid="reader-appearance-trigger"]').exists()).toBe(false);
});

it('keeps Aa unavailable until ArticleDetail has rendered RSS body content', async () => {
  const empty = await mountArticleDetailWithToolbarStub('');
  expect(empty.getComponent({ name: 'ArticleToolbar' }).props('hasReaderContent')).toBe(false);
  empty.unmount();

  const rendered = await mountArticleDetailWithToolbarStub('<p>Body</p>');
  expect(rendered.getComponent({ name: 'ArticleToolbar' }).props('hasReaderContent')).toBe(true);
});

it('passes Magazine to the reading column and title only while reading', async () => {
  setSettingsFromRawData({
    content_font_family: 'serif', content_font_size: '17', content_line_height: '1.7',
    content_width: 'comfortable', content_paragraph_spacing: 'comfortable',
  });
  const wrapper = mountReader('<p>Body</p>', { isReadingMode: true });

  expect(wrapper.get('[data-testid="article-reading-column"]').attributes('data-reader-style')).toBe('magazine');
  expect(wrapper.findComponent(ArticleTitle).props('readerStyle')).toBe('magazine');
  await wrapper.setProps({ isReadingMode: false });
  expect(wrapper.findComponent(ArticleTitle).props('readerStyle')).toBe('custom');
});

it('adds editorial title rhythm only for Magazine', () => {
  const wrapper = mountTitle('magazine');

  expect(wrapper.get('h1').classes()).toContain('article-title--magazine');
  expect(wrapper.get('[data-testid="article-title-meta"]').classes()).toContain('article-title-meta--magazine');
});
~~~

- [ ] **Step 2: Run the focused integration tests and verify they fail before wiring**

Run:

~~~bash
cd frontend && npm run test:unit -- src/components/article/ArticleToolbar.test.ts src/components/article/ArticleDetail.test.ts src/components/article/ArticleContent.test.ts src/components/article/parts/ArticleTitle.test.ts
~~~

Expected: FAIL because no Aa trigger, panel mapping, data-reader-style, readerStyle prop, or Magazine title classes exist.

- [ ] **Step 3: Wire the toolbar to the persistence composable and reader panel**

~~~ts
const appearanceTrigger = ref<HTMLButtonElement>();
const isReaderAppearanceOpen = ref(false);
const store = useAppStore();
const preferences = useReaderTypographyPreferences({ settings });

async function closeReaderAppearance(): Promise<void> {
  isReaderAppearanceOpen.value = false;
  await preferences.flushSave();
  await nextTick();
  appearanceTrigger.value?.focus({ preventScroll: true });
}
~~~

~~~ts
// ArticleDetail.vue
const hasReaderContent = computed(
  () => !isLoadingContent.value && Boolean(articleContent.value.trim())
);
~~~

Add PhTextAa after the existing reading-mode divider. The button has data-testid="reader-appearance-trigger", localized title and aria-label, aria-expanded, and aria-controls="reader-appearance-panel". Render ReaderAppearancePanel only while the reader panel is open. Forward select-preset to preferences.applyPreset, update-typography to preferences.updateTypography, restore to preferences.applyThemeRecommendation(store.theme), retry to preferences.retrySave, and close to closeReaderAppearance.

Import computed in ArticleDetail, pass hasReaderContent as has-reader-content, and use the boolean in the toolbar Aa condition. If reading mode becomes inactive or hasReaderContent becomes false while the panel is open, close and flush it. On toolbar unmount, invoke void preferences.flushSave() so a navigation or article close cannot discard the final pending adjustment.

- [ ] **Step 4: Resolve and apply the narrow Magazine visual state in article components**

~~~ts
const readerStyle = computed<ReaderTypographyPresetId | 'custom'>(() =>
  props.isReadingMode ? getReaderTypographyPreset(appSettings.value) : 'custom'
);
~~~

Set :data-reader-style="readerStyle" on article-reading-column and pass :reader-style="readerStyle" into ArticleTitle. In ArticleTitle, conditionally add article-title--magazine to the h1 and article-title-meta--magazine to the metadata row. Add scoped CSS that uses inherited --reader-font-family, --reader-font-size, semantic text and border variables, and modest title/metadata spacing. Do not change image, summary, body, translation, audio, video, or link styling.

- [ ] **Step 5: Run the focused integration tests and verify focus and visual-state contracts**

Run:

~~~bash
cd frontend && npm run test:unit -- src/components/article/ArticleToolbar.test.ts src/components/article/ArticleDetail.test.ts src/components/article/ArticleContent.test.ts src/components/article/parts/ArticleTitle.test.ts
~~~

Expected: PASS; Aa is isolated to reading mode, it returns focus after close, the active reading column exposes Magazine, and title rhythm returns to neutral for Custom or non-reading content.

- [ ] **Step 6: Run targeted lint and commit only Task 4 files**

Run:

~~~bash
cd frontend && npx eslint src/components/article/ArticleToolbar.vue src/components/article/ArticleToolbar.test.ts src/components/article/ArticleDetail.vue src/components/article/ArticleDetail.test.ts src/components/article/ArticleContent.vue src/components/article/ArticleContent.test.ts src/components/article/parts/ArticleTitle.vue src/components/article/parts/ArticleTitle.test.ts
git add -- frontend/src/components/article/ArticleToolbar.vue frontend/src/components/article/ArticleToolbar.test.ts frontend/src/components/article/ArticleDetail.vue frontend/src/components/article/ArticleDetail.test.ts frontend/src/components/article/ArticleContent.vue frontend/src/components/article/ArticleContent.test.ts frontend/src/components/article/parts/ArticleTitle.vue frontend/src/components/article/parts/ArticleTitle.test.ts
git commit -m "feat(reader): integrate appearance controls"
~~~

Expected: ESLint exits with code 0 and the commit contains only the Task 4 implementation and tests.

## Final Verification and Browser Acceptance

- [ ] **Step 1: Run the complete frontend unit suite and production build**

Run:

~~~bash
cd frontend && npm run test:unit
cd frontend && npm run build
~~~

Expected: every Vitest suite passes and Vite writes the production bundle without TypeScript or CSS errors.

- [ ] **Step 2: Run backend and desktop build verification**

Run:

~~~bash
go test -v -timeout=5m ./...
wails3 build
~~~

Expected: Go tests pass and Wails produces a current-platform desktop build.

- [ ] **Step 3: Perform browser acceptance in desktop and mobile viewports**

Start the local application with a loaded RSS article, then use the browser automation flow against its local URL. At a 1440px viewport, enter reading mode and verify that the article scroll region receives focus. Open Aa, select Magazine, change font size, density, font, and width, then close the panel by clicking outside it and verify focus returns to Aa. Reopen it, close it with Escape, and verify the same focus return. Change the app theme and verify the selected typography remains unchanged; use the restore command and verify it applies the current theme recommendation.

At a 390px viewport, open Aa and verify the bottom sheet has aria-modal="true", the width control is absent, the controls and text wrap without horizontal page overflow, Tab remains inside the sheet, and Escape returns focus to Aa. Verify Paper, Ink, Sepia, and High Contrast alter semantic colors without changing manually selected typography.

- [ ] **Step 4: Check repository scope and report results**

Run:

~~~bash
git diff --check
git status --short
~~~

Expected: git diff --check has no output. Report the exact test/build/browser outcomes, commits created for Tasks 1–4, and unrelated pre-existing dirty files without staging or changing them.
