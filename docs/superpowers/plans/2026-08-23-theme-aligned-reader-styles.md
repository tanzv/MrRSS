# Theme-Aligned Reader Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide built-in reader typography styles aligned with Paper, Ink, Sepia, and High Contrast while preserving manual reader typography choices across theme changes.

**Architecture:** Keep the five existing reader typography settings as the only persisted reader state. Extend the pure reader typography utility with a deterministic effective-theme-to-preset map, pass the resolved `ThemePreset` from the Pinia store into the settings picker and preview, and surface it as read-only data on the reader column. The root theme engine remains the sole owner of colors.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Pinia, Vitest/Vue Test Utils, existing i18n messages, existing CSS custom properties.

## Global Constraints

- Do not add settings schema fields, backend handlers, database migrations, dependencies, or network requests.
- Built-in themes and custom theme profile persistence remain unchanged; reader recommendations use the store's resolved `ThemePreset` base theme.
- Only explicit reader-style selection writes the five `content_*` fields; switching app themes never changes them.
- Preserve existing dirty worktree changes. Do not create code commits in the shared `main` worktree.
- Every behavior change receives a matching deterministic test written and observed failing before production code.
- Use existing semantic CSS variables for reader colors; do not duplicate a color-theme engine in reader components.

---

### Task 1: Add Theme-to-Reader-Preset Mapping

**Files:**
- Modify: `frontend/src/utils/readerTypography.ts`
- Test: `frontend/src/utils/readerTypography.test.ts`

**Interfaces:**
- `ReaderTypographyPresetId` becomes `'focus' | 'night' | 'book' | 'clarity' | 'compact'`.
- `readerThemePresetMap: Readonly<Record<ThemePreset, ReaderTypographyPresetId>>` maps `paper`, `ink`, `sepia`, and `high-contrast`.
- `getRecommendedReaderTypographyPreset(theme: unknown): ReaderTypographyPreset` returns a concrete preset and falls back to `focus` for unknown themes.

- [ ] **Step 1: Write failing tests for recommendation mapping and new styles**

```ts
it('maps each resolved application theme to its recommended reader style', () => {
  expect(getRecommendedReaderTypographyPreset('paper').id).toBe('focus');
  expect(getRecommendedReaderTypographyPreset('ink').id).toBe('night');
  expect(getRecommendedReaderTypographyPreset('sepia').id).toBe('book');
  expect(getRecommendedReaderTypographyPreset('high-contrast').id).toBe('clarity');
  expect(getRecommendedReaderTypographyPreset('unknown').id).toBe('focus');
});

it('recognizes the complete Night and Clarity typography values', () => {
  expect(getReaderTypographyPreset({
    content_font_family: 'system', content_font_size: 17, content_line_height: '1.7',
    content_width: 'comfortable', content_paragraph_spacing: 'relaxed',
  })).toBe('night');
  expect(getReaderTypographyPreset({
    content_font_family: 'system', content_font_size: 18, content_line_height: '1.8',
    content_width: 'comfortable', content_paragraph_spacing: 'relaxed',
  })).toBe('clarity');
});
```

- [ ] **Step 2: Run the focused test and verify it fails for missing exports/styles**

Run: `npm test -- --run src/utils/readerTypography.test.ts`

Expected: FAIL because `getRecommendedReaderTypographyPreset` and the two style ids do not exist.

- [ ] **Step 3: Implement the two presets and pure recommendation map**

```ts
export const readerThemePresetMap = {
  paper: 'focus',
  ink: 'night',
  sepia: 'book',
  'high-contrast': 'clarity',
} as const satisfies Readonly<Record<ThemePreset, ReaderTypographyPresetId>>;

export function getRecommendedReaderTypographyPreset(theme: unknown): ReaderTypographyPreset {
  const presetId = readerThemePresetMap[theme as ThemePreset] ?? 'focus';
  return readerTypographyPresets.find((preset) => preset.id === presetId) ?? readerTypographyPresets[0];
}
```

Use the specified Night and Clarity values from the design. Keep all parsing and rendering behavior pure and unchanged.

- [ ] **Step 4: Run the focused utility test and verify it passes**

Run: `npm test -- --run src/utils/readerTypography.test.ts`

Expected: PASS.

- [ ] **Step 5: Run a type/lint checkpoint**

Run: `npx eslint src/utils/readerTypography.ts src/utils/readerTypography.test.ts`

Expected: exit code 0.

### Task 2: Surface Theme Alignment in the Style Picker

**Files:**
- Modify: `frontend/src/components/settings/ReaderTypographyPresetPicker.vue`
- Test: `frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- `ReaderTypographyPresetPicker` accepts `themePreset: ThemePreset`.
- It exposes one radio for each of the five styles, `data-reader-style-theme` for theme-bound styles, and `data-reader-theme-recommendation="true"` on the style recommended for `themePreset`.
- Its `select` event remains `[values: ReaderTypographyValues]`.

- [ ] **Step 1: Write failing picker tests**

```ts
it('marks the Ink recommendation without selecting or mutating typography', () => {
  const wrapper = mountPicker(focusSettings, 'ink');
  expect(wrapper.findAll('[role="radio"]')).toHaveLength(5);
  expect(wrapper.get('[data-reader-preset="night"]').attributes('data-reader-theme-recommendation')).toBe('true');
  expect(wrapper.get('[data-reader-preset="focus"]').attributes('aria-checked')).toBe('true');
});

it('emits every explicit Night value when the Ink-related style is selected', async () => {
  const wrapper = mountPicker(focusSettings, 'ink');
  await wrapper.get('[data-reader-preset="night"]').trigger('click');
  expect(wrapper.emitted('select')?.[0]).toEqual([{
    content_font_family: 'system', content_font_size: 17, content_line_height: '1.7',
    content_width: 'comfortable', content_paragraph_spacing: 'relaxed',
  }]);
});
```

- [ ] **Step 2: Run the focused picker test and verify it fails**

Run: `npm test -- --run src/components/settings/ReaderTypographyPresetPicker.test.ts`

Expected: FAIL because the picker has three choices and no `themePreset` prop or recommendation marker.

- [ ] **Step 3: Add theme-aware option metadata and accessible visual treatment**

Each bound option includes a `themePreset` and localized theme label. Render a small three-stripe swatch, a visible theme-name label, and an icon-only recommended marker with an accessible label. Keep selected state independent from recommended state. Use two stable grid columns on desktop and one column at small widths.

Add English and Simplified Chinese messages for Night, Clarity, their descriptions, theme association, and recommendation accessibility text. Do not add instructional paragraphs.

- [ ] **Step 4: Run picker and i18n-facing tests**

Run: `npm test -- --run src/components/settings/ReaderTypographyPresetPicker.test.ts`

Expected: PASS.

- [ ] **Step 5: Run a targeted lint checkpoint**

Run: `npx eslint src/components/settings/ReaderTypographyPresetPicker.vue src/components/settings/ReaderTypographyPresetPicker.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts`

Expected: exit code 0.

### Task 3: Connect Resolved Theme State to Settings, Preview, and Reader Surface

**Files:**
- Modify: `frontend/src/components/modals/settings/reading/TypographySettings.vue`
- Test: `frontend/src/components/modals/settings/reading/TypographySettings.test.ts`
- Modify: `frontend/src/components/settings/ReaderTypographyPreview.vue`
- Test: `frontend/src/components/settings/ReaderTypographyPreview.test.ts`
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Test: `frontend/src/components/article/ArticleContent.test.ts`

**Interfaces:**
- `TypographySettings` reads `useAppStore().theme` and passes it to the picker and preview.
- `ReaderTypographyPreview` accepts `themePreset: ThemePreset` and exposes `data-reader-theme`.
- `ArticleContent` exposes `data-reader-theme="store.theme"` on `[data-testid="article-reading-column"]`.

- [ ] **Step 1: Write failing integration tests**

```ts
it('passes the resolved Ink theme to the reader picker without overwriting selected typography', () => {
  const pinia = createPinia();
  const store = useAppStore(pinia);
  store.theme = 'ink';
  const wrapper = mount(TypographySettings, { global: { plugins: [pinia, i18n] }, props: { settings } });
  expect(wrapper.get('[data-reader-preset="night"]').attributes('data-reader-theme-recommendation')).toBe('true');
  expect(wrapper.get('[data-reader-preset="focus"]').attributes('aria-checked')).toBe('true');
});

it('labels the preview and reader column with the resolved theme', () => {
  expect(preview.attributes('data-reader-theme')).toBe('sepia');
  expect(column.attributes('data-reader-theme')).toBe('sepia');
});
```

- [ ] **Step 2: Run the three focused tests and verify they fail**

Run: `npm test -- --run src/components/modals/settings/reading/TypographySettings.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/article/ArticleContent.test.ts`

Expected: FAIL because no component accepts or renders `themePreset` / `data-reader-theme`.

- [ ] **Step 3: Wire the store theme through existing component boundaries**

Use a computed `themePreset` in `TypographySettings`; do not copy the theme into local state. Add a required typed preview prop and set attributes only. Reuse the `store` already present in `ArticleContent`; do not fetch settings or theme data again.

- [ ] **Step 4: Run the focused integration tests and verify they pass**

Run: `npm test -- --run src/components/modals/settings/reading/TypographySettings.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/article/ArticleContent.test.ts`

Expected: PASS.

- [ ] **Step 5: Run a targeted lint checkpoint**

Run: `npx eslint src/components/modals/settings/reading/TypographySettings.vue src/components/settings/ReaderTypographyPreview.vue src/components/article/ArticleContent.vue`

Expected: exit code 0.

### Task 4: Verify Theme Switching and Responsive Reading UI

**Files:**
- Test: existing reader typography, picker, settings, preview, and reader-content test files
- No production file expected unless visual verification exposes a real defect

- [ ] **Step 1: Run all focused reader-style tests**

Run: `npm test -- --run src/utils/readerTypography.test.ts src/components/settings/ReaderTypographyPresetPicker.test.ts src/components/modals/settings/reading/TypographySettings.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/article/ArticleContent.test.ts`

Expected: PASS.

- [ ] **Step 2: Build the frontend**

Run: `npm run build`

Expected: successful Vite production build.

- [ ] **Step 3: Browser acceptance with mocked article API**

Open the existing local Vite server with a Playwright route fixture. In the reading settings, choose Ink, Sepia, and High Contrast in turn. For each theme confirm the corresponding recommendation marker changes while a manually chosen Focus style remains selected. Open an RSS article in reading mode on 1440px and 390px viewports; confirm the reader column and preview expose the expected theme value, theme colors render, the card grid fits, and no horizontal overflow occurs.

- [ ] **Step 4: Run final checks**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Preserve the shared working tree**

Do not stage, commit, reset, merge, or delete unrelated work. Report the exact verification results and current local preview URL.
