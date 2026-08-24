# Built-in Theme Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give MrRSS four persistent, accessible built-in theme presets while retaining Auto as a system-following mode and preserving old light/dark preferences.

**Architecture:** A small frontend theme module owns canonical values, legacy normalization, system resolution, and DOM application. The existing schema-backed `theme` setting remains the persisted source of truth; the Pinia store and startup script consume the same value model. CSS tokens hold each palette, while a focused settings component renders the selectable presets.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Tailwind CSS variables, vue-i18n, Vitest, jsdom.

## Global Constraints

- Keep `theme` as the existing schema-backed string setting; do not add a second theme mode setting or database migration.
- Canonical values are exactly `auto`, `paper`, `ink`, `sepia`, and `high-contrast`.
- Normalize legacy `light` to `paper`, legacy `dark` to `ink`, and unknown values to `auto`.
- Auto resolves to Paper in system light mode and Ink in system dark mode.
- Custom CSS remains article-content-only.
- All user-facing copy uses English and Simplified Chinese i18n entries.
- Preserve `.dark-mode` for Ink and High Contrast so existing article/content dark selectors continue to work.
- Test before implementation; do not touch existing user changes in `ArticleToolbar.vue` or its test.

---

### Task 1: Define and test the canonical theme model

**Files:**

- Create: `frontend/src/utils/theme.ts`
- Create: `frontend/src/utils/theme.test.ts`

**Interfaces:**

- Produces `ThemePreference = 'auto' | 'paper' | 'ink' | 'sepia' | 'high-contrast'`.
- Produces `ThemePreset = Exclude<ThemePreference, 'auto'>`.
- Produces `normalizeThemePreference(value: unknown): ThemePreference`.
- Produces `resolveThemePreset(preference: ThemePreference, prefersDark: boolean): ThemePreset`.
- Produces `isDarkThemePreset(preset: ThemePreset): boolean`.
- Produces `applyThemePreference(preference: ThemePreference, prefersDark: boolean): ThemePreset` for DOM attributes/classes/local storage.

- [ ] **Step 1: Write the failing utility tests**

```ts
import { describe, expect, it } from "vitest";
import {
  applyThemePreference,
  normalizeThemePreference,
  resolveThemePreset,
} from "./theme";

it("normalizes legacy and unknown values", () => {
  expect(normalizeThemePreference("light")).toBe("paper");
  expect(normalizeThemePreference("dark")).toBe("ink");
  expect(normalizeThemePreference("sepia")).toBe("sepia");
  expect(normalizeThemePreference("unexpected")).toBe("auto");
});

it("resolves auto from the system scheme", () => {
  expect(resolveThemePreset("auto", false)).toBe("paper");
  expect(resolveThemePreset("auto", true)).toBe("ink");
});

it("applies canonical attributes and dark classes", () => {
  applyThemePreference("high-contrast", false);
  expect(document.documentElement.dataset.themePreset).toBe("high-contrast");
  expect(document.documentElement.classList.contains("dark-mode")).toBe(true);
  expect(localStorage.getItem("themePreference")).toBe("high-contrast");
});
```

- [ ] **Step 2: Run the test to verify the missing module fails**

Run: `cd frontend && npm run test:unit -- src/utils/theme.test.ts`

Expected: FAIL because `./theme` does not exist.

- [ ] **Step 3: Implement the utility module**

```ts
export const themePreferences = [
  "auto",
  "paper",
  "ink",
  "sepia",
  "high-contrast",
] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ThemePreset = Exclude<ThemePreference, "auto">;

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "light") return "paper";
  if (value === "dark") return "ink";
  return themePreferences.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : "auto";
}
```

Implement resolution and DOM application using `data-theme-preset`, `.dark-mode`, `localStorage`, and the preset background map.

- [ ] **Step 4: Run the utility tests to verify they pass**

Run: `cd frontend && npm run test:unit -- src/utils/theme.test.ts`

Expected: PASS with legacy mapping, Auto resolution, and DOM application coverage.

### Task 2: Integrate theme state, persistence, and flash-free startup

**Files:**

- Modify: `frontend/src/stores/app.ts:7-9, 30-53, 353-405`
- Modify: `frontend/src/composables/core/useSettings.ts:43-52`
- Modify: `frontend/src/composables/core/useSettingsAutoSave.ts:96-100`
- Modify: `frontend/src/components/modals/SettingsModal.vue:29, 79`
- Modify: `frontend/src/App.vue:145-148`
- Modify: `frontend/index.html:10-31`
- Test: `frontend/src/utils/theme.test.ts`

**Interfaces:**

- Consumes `ThemePreference`, `ThemePreset`, `normalizeThemePreference`, and `applyThemePreference` from `@/utils/theme`.
- Produces `store.themePreference: Ref<ThemePreference>` and `store.theme: Ref<ThemePreset>`.
- `store.setTheme(preference: ThemePreference | string): void` accepts persisted legacy values safely.

- [ ] **Step 1: Extend the failing theme tests for store-compatible application**

```ts
it("keeps manual themes stable across system changes", () => {
  expect(resolveThemePreset("sepia", true)).toBe("sepia");
  expect(resolveThemePreset("high-contrast", false)).toBe("high-contrast");
});

it("removes the dark class for a light preset", () => {
  applyThemePreference("sepia", true);
  expect(document.documentElement.classList.contains("dark-mode")).toBe(false);
  expect(document.body.classList.contains("dark-mode")).toBe(false);
});
```

- [ ] **Step 2: Run the expanded test to verify the behavior is not yet implemented**

Run: `cd frontend && npm run test:unit -- src/utils/theme.test.ts`

Expected: FAIL until the DOM helper fully synchronizes both root elements.

- [ ] **Step 3: Replace ad hoc light/dark logic with the theme module**

Update `app.ts` so `setTheme` normalizes before storing and `applyTheme` resolves through `window.matchMedia`. Keep system media listeners active only for `auto`. Update callers to pass raw persisted strings without light/dark union casts.

Update the inline startup script with the same legacy mapping and canonical values. It must set `document.documentElement.dataset.themePreset`, the correct background, and `.dark-mode` before CSS loads.

- [ ] **Step 4: Run targeted tests and type/build verification**

Run: `cd frontend && npm run test:unit -- src/utils/theme.test.ts && npm run build`

Expected: PASS and a successful Vite production build.

### Task 3: Add tokenized preset palettes and theme selection UI

**Files:**

- Modify: `frontend/src/style.css:4-37, 101-161, 200-229`
- Create: `frontend/src/components/settings/ThemePresetPicker.vue`
- Create: `frontend/src/components/settings/ThemePresetPicker.test.ts`
- Modify: `frontend/src/components/modals/settings/general/ApplicationSettings.vue:1-82`
- Modify: `frontend/src/i18n/locales/en.ts:852-869`
- Modify: `frontend/src/i18n/locales/zh.ts:834-851`

**Interfaces:**

- Consumes `ThemePreference` and `themePreferences` from `@/utils/theme`.
- `ThemePresetPicker` props: `modelValue: ThemePreference`.
- `ThemePresetPicker` emits: `'update:modelValue': [value: ThemePreference]`.
- `ThemePresetPicker` renders an accessible `radiogroup` with five radio buttons.

- [ ] **Step 1: Write the failing picker component test**

```ts
const wrapper = mount(ThemePresetPicker, {
  props: { modelValue: "paper" },
  global: { plugins: [i18n] },
});

expect(wrapper.get('[role="radiogroup"]').attributes("aria-label")).toBe(
  "Theme",
);
expect(wrapper.findAll('[role="radio"]')).toHaveLength(5);
expect(
  wrapper.get('[data-theme-option="paper"]').attributes("aria-checked"),
).toBe("true");

await wrapper.get('[data-theme-option="sepia"]').trigger("click");
expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["sepia"]);
```

- [ ] **Step 2: Run the picker test to verify it fails**

Run: `cd frontend && npm run test:unit -- src/components/settings/ThemePresetPicker.test.ts`

Expected: FAIL because `ThemePresetPicker.vue` does not exist.

- [ ] **Step 3: Implement the token palettes and picker**

Define Paper as the root default and use `[data-theme-preset='ink']`, `[data-theme-preset='sepia']`, and `[data-theme-preset='high-contrast']` overrides for every semantic surface/text/border/accent/code token. Add state tokens for favorite and read-later states.

Render Auto plus four preset buttons with a compact color preview, localized names/descriptions, `role="radio"`, `aria-checked`, and a visible selected indicator. Use CSS grid with `minmax(0, 1fr)` tracks so the picker remains usable at narrow widths. Replace the old theme `SettingWithSelect` with the picker in `ApplicationSettings.vue`.

- [ ] **Step 4: Run picker tests and production build**

Run: `cd frontend && npm run test:unit -- src/components/settings/ThemePresetPicker.test.ts && npm run build`

Expected: PASS and a successful production build.

### Task 4: Apply state tokens at core reading surfaces and verify end-to-end appearance

**Files:**

- Modify: `frontend/src/components/article/ArticleItem.vue:300-422`
- Modify: `frontend/src/components/article/ArticleCardItem.vue:175-251`
- Modify: `frontend/src/components/article/ArticleToolbar.vue` only if needed to replace existing state color classes without changing unrelated user edits
- Test: `frontend/src/utils/theme.test.ts`

**Interfaces:**

- Consumes `--state-favorite-*` and `--state-read-later-*` CSS variables from `style.css`.
- Produces consistent favorite/read-later backgrounds and icons across Paper, Ink, Sepia, and High Contrast.

- [ ] **Step 1: Add a failing DOM/token assertion to the theme test**

```ts
it("exposes a resolved preset that the CSS selector can target", () => {
  applyThemePreference("sepia", false);
  expect(document.documentElement.getAttribute("data-theme-preset")).toBe(
    "sepia",
  );
});
```

- [ ] **Step 2: Run the test to establish the selector contract**

Run: `cd frontend && npm run test:unit -- src/utils/theme.test.ts`

Expected: PASS after Task 2; this protects the DOM contract before component style changes.

- [ ] **Step 3: Replace core reading-state literal colors with semantic token classes/styles**

Use CSS variables for favorite/read-later icon color and tinted background in article list and card views. Do not edit unrelated user changes in `ArticleToolbar.vue`; only update its state color bindings if the same literals are present and preserve its current behavior.

- [ ] **Step 4: Verify visual output and accessibility**

Run: `cd frontend && npm run build`

Start Vite, then use browser automation to select each preset and capture desktop plus 390px screenshots. Run an axe scan on the theme picker and verify every radio has a name, selected state, and visible focus indicator.

## Plan Self-Review

- Spec coverage: Task 1 covers canonical values and legacy migration; Task 2 covers persistence, store integration, Auto, and startup behavior; Task 3 covers palettes, selection UI, i18n, and responsive behavior; Task 4 covers core state-token integration and browser verification.
- Placeholder scan: no TBD/TODO/future-work markers or generic test instructions remain.
- Type consistency: `ThemePreference`, `ThemePreset`, normalization, resolution, and DOM application are defined in Task 1 and consumed with the same names in later tasks.
