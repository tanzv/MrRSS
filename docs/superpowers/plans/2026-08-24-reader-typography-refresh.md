# Reader Typography Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the theme-coupled reader-style list with a compact four-style typography panel whose first screen exposes installed-font selection and reader controls.

**Architecture:** Keep the five existing `content_*` settings as the only persisted reader state. Simplify the pure typography model to four semantically distinct presets, remove theme-to-typography recommendation coupling, and reuse the existing local-font selector in both settings and the in-reader `Aa` panel. The global theme engine remains the only owner of colors.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Pinia, vue-i18n, Tailwind CSS, Vitest, Vue Test Utils, Wails v3.

## Global Constraints

- Implement [the approved design](../specs/2026-08-24-reader-typography-refresh-design.md) exactly: four presets, local installed-font selection, and no theme recommendation UI.
- Do not add settings-schema fields, database migrations, backend endpoints, dependencies, font downloads, remote fonts, or arbitrary font-name input.
- Preserve `content_font_family`, `content_font_size`, `content_line_height`, `content_width`, and `content_paragraph_spacing` as the sole persisted reader state.
- Do not let switching Paper, Ink, Sepia, or High Contrast overwrite reader typography; semantic CSS variables remain the only reader color source.
- Maintain keyboard-accessible radio controls, visible focus, desktop popover/mobile dialog behavior, 10–24px size limits, batched persistence, and error retry.
- Keep existing user changes in `frontend/package.json` and `frontend/package-lock.json` untouched. Do not stage, reset, clean, or commit implementation files in the shared worktree.
- For each behavior, write the test first and observe the expected failure before changing production code.

---

## File Structure

- `frontend/src/utils/readerTypography.ts`: Four preset definitions, complete-match detection, normalized reader CSS variables, and a deterministic default-preset accessor.
- `frontend/src/utils/readerTypography.test.ts`: Pure-model coverage for the four presets, custom state, and restoration default.
- `frontend/src/components/settings/ReaderTypographyPresetPicker.vue`: Shared four-option accessible picker with no global-theme dependency or decorative color swatches.
- `frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts`: Picker option count, keyboard selection, custom state, and removal of theme recommendation output.
- `frontend/src/components/settings/ReaderTypographyPreview.vue`: Theme-independent live typography preview.
- `frontend/src/components/modals/settings/reading/TypographySettings.vue`: Settings-page integration without a theme prop.
- `frontend/src/components/modals/settings/reading/TypographySettings.test.ts`: Settings-page propagation of the four preset values and independent font changes.
- `frontend/src/composables/article/useReaderTypographyPreferences.ts`: Shared reader settings persistence and default restoration command.
- `frontend/src/composables/article/useReaderTypographyPreferences.test.ts`: Immediate preview, debounce, default restore, error, and retry behavior.
- `frontend/src/components/article/ReaderAppearancePanel.vue`: Compact desktop popover/mobile sheet with font selection before size, live preview, and responsive layout.
- `frontend/src/components/article/ReaderAppearancePanel.test.ts`: Four-option panel behavior, font propagation, preview presence, responsive controls, focus, and save failure behavior.
- `frontend/src/components/article/ArticleToolbar.vue`: Wires the renamed restore command and removes theme recommendation input from the panel.
- `frontend/src/components/article/ArticleToolbar.test.ts`: Existing reader trigger and close/focus behavior remain intact after the command rename.
- `frontend/src/i18n/locales/en.ts` and `frontend/src/i18n/locales/zh.ts`: “Reading typography/阅读排版” labels and “Restore default typography/恢复默认排版” copy.

## Task 1: Simplify the Pure Reader Typography Model

**Files:**
- Modify: `frontend/src/utils/readerTypography.ts`
- Modify: `frontend/src/utils/readerTypography.test.ts`

**Interfaces:**
- Consumes: `ReaderTypographyInput` with the five persisted `content_*` fields.
- Produces: `ReaderTypographyPresetId = 'focus' | 'magazine' | 'book' | 'compact'`.
- Produces: `getDefaultReaderTypographyPreset(): ReaderTypographyPreset`, returning Focus’s complete values.
- Removes: `readerThemePresetMap` and `getRecommendedReaderTypographyPreset`.

- [ ] **Step 1: Write the failing model tests for the four-style contract**

```ts
import {
  getDefaultReaderTypographyPreset,
  getReaderTypographyPreset,
  readerTypographyPresets,
} from './readerTypography';

it('offers only the four typography styles that remain meaningful without an app theme', () => {
  expect(readerTypographyPresets.map((preset) => preset.id)).toEqual([
    'focus',
    'magazine',
    'book',
    'compact',
  ]);
});

it('restores the complete Focus values without consulting the current app theme', () => {
  expect(getDefaultReaderTypographyPreset().values).toEqual({
    content_font_family: 'system',
    content_font_size: 16,
    content_line_height: '1.6',
    content_width: 'comfortable',
    content_paragraph_spacing: 'comfortable',
  });
});

it('reports Custom after a one-field change from a selected preset', () => {
  expect(getReaderTypographyPreset({
    ...getDefaultReaderTypographyPreset().values,
    content_font_family: 'PingFang SC',
  })).toBe('custom');
});
```

Delete the old tests that assert Ink/Night, Sepia/Book, High Contrast/Clarity mapping because that product contract is intentionally retired.

- [ ] **Step 2: Run the focused model test and verify it fails for the old six-style/theme-coupled model**

Run: `cd frontend && npm run test:unit -- src/utils/readerTypography.test.ts`

Expected: FAIL because Night and Clarity remain in the array and `getDefaultReaderTypographyPreset` does not exist.

- [ ] **Step 3: Implement the smallest pure-model change**

```ts
export type ReaderTypographyPresetId = 'focus' | 'magazine' | 'book' | 'compact';

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
    id: 'magazine',
    values: {
      content_font_family: 'serif',
      content_font_size: 17,
      content_line_height: '1.7',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
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

export function getDefaultReaderTypographyPreset(): ReaderTypographyPreset {
  return readerTypographyPresets[0];
}
```

Remove the `ThemePreset` import, `readerThemePresetMap`, Night/Clarity entries, and `getRecommendedReaderTypographyPreset`. Keep normalization, `resolveReaderTypography`, and all five-field matching unchanged.

- [ ] **Step 4: Run the model test and verify it passes**

Run: `cd frontend && npm run test:unit -- src/utils/readerTypography.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the targeted formatter/linter checkpoint**

Run: `cd frontend && npx eslint src/utils/readerTypography.ts src/utils/readerTypography.test.ts`

Expected: exit code 0.

## Task 2: Rebuild the Shared Picker and Settings Integration

**Files:**
- Modify: `frontend/src/components/settings/ReaderTypographyPresetPicker.vue`
- Modify: `frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts`
- Modify: `frontend/src/components/settings/ReaderTypographyPreview.vue`
- Modify: `frontend/src/components/settings/ReaderTypographyPreview.test.ts`
- Modify: `frontend/src/components/modals/settings/reading/TypographySettings.vue`
- Modify: `frontend/src/components/modals/settings/reading/TypographySettings.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- `ReaderTypographyPresetPicker` accepts only `{ settings: ReaderTypographyInput; variant?: 'settings' | 'compact' }` and emits `select(values: ReaderTypographyValues)`.
- `ReaderTypographyPreview` accepts only `{ typography: ReaderTypography }`.
- `TypographySettings` passes the shared settings to both components and does not read `useAppStore().theme`.

- [ ] **Step 1: Write the failing picker/settings/preview tests**

```ts
it('renders four neutral reader typography choices without a theme recommendation', () => {
  const wrapper = mountPicker();

  expect(wrapper.findAll('[role="radio"]')).toHaveLength(4);
  expect(wrapper.find('[data-reader-style-theme]').exists()).toBe(false);
  expect(wrapper.find('[data-reader-theme-recommendation]').exists()).toBe(false);
});

it('uses the compact two-column picker in the reader panel', () => {
  const wrapper = mountPicker(focusSettings, { variant: 'compact' });

  expect(wrapper.get('[role="radiogroup"]').classes()).toContain(
    'reader-typography-preset-picker--compact'
  );
  expect(wrapper.findAll('[role="radio"]')).toHaveLength(4);
});

it('keeps a named local font as an independent reader setting', async () => {
  const wrapper = mount(TypographySettings, { props: { settings: createSettings() }, global });

  wrapper.findComponent(FontFamilySelect).vm.$emit('update:modelValue', 'PingFang SC');

  expect(wrapper.emitted('update:settings')?.[0]?.[0]).toMatchObject({
    content_font_family: 'PingFang SC',
    content_font_size: 16,
    content_line_height: '1.6',
  });
});
```

Update existing tests so they no longer pass a `ThemePreset`, assert theme recommendation copy, or expect Night/Clarity controls.

- [ ] **Step 2: Run the focused component tests and verify they fail against the current theme-coupled picker**

Run: `cd frontend && npm run test:unit -- src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/modals/settings/reading/TypographySettings.test.ts`

Expected: FAIL because the picker renders six controls and emits theme-related data attributes.

- [ ] **Step 3: Implement neutral shared components and localized copy**

```ts
interface Props {
  settings: ReaderTypographyInput;
  variant?: 'settings' | 'compact';
}

const props = withDefaults(defineProps<Props>(), { variant: 'settings' });
const selectedPreset = computed(() => getReaderTypographyPreset(props.settings));
```

Remove `ThemePreset`, theme-label computation, swatches, sparkle icon, theme recommendation attributes, and `themePreset` props. Change compact picker CSS to `grid-cols-2 gap-1.5`; retain the two-column settings layout and existing radio keyboard controls. Let the selected check icon be the only status indicator.

Remove `themePreset` from `ReaderTypographyPreview` and its `data-reader-theme` attribute. Remove `useAppStore`/theme calculation from `TypographySettings` and stop passing the theme prop. Delete Night/Clarity/recommendation translation entries, change `article.readingMode.appearance`/`appearanceTitle` to “Reading typography” and “阅读排版”, and add `appearanceRestoreDefault` as “Restore default typography” / “恢复默认排版”.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `cd frontend && npm run test:unit -- src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/modals/settings/reading/TypographySettings.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the targeted formatter/linter checkpoint**

Run: `cd frontend && npx eslint src/components/settings/ReaderTypographyPresetPicker.vue src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/settings/ReaderTypographyPreview.vue src/components/settings/ReaderTypographyPreview.test.ts src/components/modals/settings/reading/TypographySettings.vue src/components/modals/settings/reading/TypographySettings.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts`

Expected: exit code 0.

## Task 3: Make Font Selection and Preview First-Class in the Reader Panel

**Files:**
- Modify: `frontend/src/composables/article/useReaderTypographyPreferences.ts`
- Modify: `frontend/src/composables/article/useReaderTypographyPreferences.test.ts`
- Modify: `frontend/src/components/article/ReaderAppearancePanel.vue`
- Modify: `frontend/src/components/article/ReaderAppearancePanel.test.ts`
- Modify: `frontend/src/components/article/ArticleToolbar.vue`
- Modify: `frontend/src/components/article/ArticleToolbar.test.ts`

**Interfaces:**
- `ReaderTypographyPreferences` replaces `applyThemeRecommendation(theme: unknown)` with `restoreDefaultTypography(): void`.
- `ReaderAppearancePanel` removes `themePreset` and emits `restore-default-typography`.
- `ArticleToolbar` calls `restoreDefaultTypography` when the panel emits that command and continues to flush before closing.

- [ ] **Step 1: Write the failing persistence/panel/toolbar tests**

```ts
it('restores Focus instead of deriving a typography style from the application theme', () => {
  const { preferences, settings } = mountPreferences({ debounceMs: 500 });

  preferences.updateTypography({ content_font_family: 'PingFang SC', content_font_size: 20 });
  preferences.restoreDefaultTypography();

  expect(settings.value).toMatchObject({
    content_font_family: 'system',
    content_font_size: 16,
    content_line_height: '1.6',
    content_width: 'comfortable',
    content_paragraph_spacing: 'comfortable',
  });
});

it('shows a live typography preview after the local-font control', () => {
  mountPanel({ mobile: false });
  const panel = getPanelElement();

  expect(panel.querySelector('[data-testid="reader-typography-preview"]')).not.toBeNull();
  expect(panel.querySelectorAll('[role="radio"]')).toHaveLength(4);
});

it('exposes the font control before the font-size controls in the reading panel', () => {
  mountPanel({ mobile: false });
  const panel = getPanelElement();
  const fontControl = panel.querySelector('[data-testid="reader-font-family-control"]');
  const sizeControl = panel.querySelector('[data-testid="reader-font-size-control"]');

  expect(fontControl?.compareDocumentPosition(sizeControl!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});
```

Update the existing toolbar test fixture to assert `restore-default-typography` is forwarded instead of `restore-theme-recommendation`.

- [ ] **Step 2: Run the focused persistence and panel tests and verify they fail for missing default restore, preview, and control order**

Run: `cd frontend && npm run test:unit -- src/composables/article/useReaderTypographyPreferences.test.ts src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.test.ts`

Expected: FAIL because the composable still requires a theme argument, the panel has no preview/test IDs, and the size control precedes the font selector.

- [ ] **Step 3: Implement the in-reader behavior with the existing local font selector**

```ts
import { getDefaultReaderTypographyPreset } from '@/utils/readerTypography';

function restoreDefaultTypography(): void {
  applyPreset(getDefaultReaderTypographyPreset().values);
}
```

In `ReaderAppearancePanel`, import `resolveReaderTypography` and `ReaderTypographyPreview`, then derive `const readerTypography = computed(() => resolveReaderTypography(props.settings));`. Render the compact picker first, followed by a `data-testid="reader-font-family-control"` control containing the existing `FontFamilySelect`, then `data-testid="reader-font-size-control"`, density, desktop width, and the preview. Remove the `themePreset` prop and replace `restore-theme-recommendation` with `restore-default-typography`.

Use the panel’s existing semantic colors and controls. Change the desktop popover width to `24rem`, use compact two-column options, and limit description copy so four choices, the font selector, and size controls fit before long-page scrolling. Keep the mobile sheet’s scroll locking, dialog semantics, focus trap, and width-control hiding unchanged.

In `ArticleToolbar`, destructure `restoreDefaultTypography`, remove the panel’s `theme-preset` binding, and bind `@restore-default-typography="restoreDefaultTypography"`. Retain `store` because its other toolbar behavior still consumes it.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `cd frontend && npm run test:unit -- src/composables/article/useReaderTypographyPreferences.test.ts src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the targeted formatter/linter checkpoint**

Run: `cd frontend && npx eslint src/composables/article/useReaderTypographyPreferences.ts src/composables/article/useReaderTypographyPreferences.test.ts src/components/article/ReaderAppearancePanel.vue src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.vue src/components/article/ArticleToolbar.test.ts`

Expected: exit code 0.

## Task 4: Reader Typography Acceptance and Build Verification

**Files:**
- Verify only; change production files only if a test or visual acceptance identifies a specific defect.

- [ ] **Step 1: Run the complete focused reader suite**

Run: `cd frontend && npm run test:unit -- src/utils/readerTypography.test.ts src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/modals/settings/reading/TypographySettings.test.ts src/composables/article/useReaderTypographyPreferences.test.ts src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the frontend production build**

Run: `cd frontend && npm run build`

Expected: Vite exits successfully without TypeScript or CSS errors.

- [ ] **Step 3: Run browser acceptance at desktop and mobile widths**

Run the app with its existing development flow, open an RSS article with rendered body content, enter reading mode, and open `Aa` at 1440px and 390px widths.

Expected: Four compact style choices appear; a searchable local-font selector is visible before the size controls; selecting a detected font immediately changes the preview and article; app theme changes do not alter selected typography; desktop supports width selection, mobile hides it; Escape/close restores focus to `Aa`; and neither viewport has horizontal overflow.

- [ ] **Step 4: Run final source checks**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only this feature’s files plus pre-existing `frontend/package.json` and `frontend/package-lock.json` changes appear.
