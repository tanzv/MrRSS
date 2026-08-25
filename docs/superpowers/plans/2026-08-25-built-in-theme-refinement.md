# Built-in Theme Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Paper, Ink, Sepia, and High Contrast into coherent reading environments and replace the theme picker’s abstract color stripes with truthful application-shell previews.

**Architecture:** Keep the existing four preset IDs and the current CSS-token architecture. First lock the exact shell palette in token and browser tests, then update `style.css` and `themeBackgroundColors` together. Refactor only `ThemePresetPicker`’s preview metadata and markup; options, persistence, radio behavior, custom-theme inheritance, and reader-canvas boundaries remain unchanged.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Tailwind CSS 4, CSS custom properties, Pinia, Vitest/Vue Test Utils, Cypress, Wails v3.

## Global Constraints

- Preserve `paper`, `ink`, `sepia`, `high-contrast`, `auto`, legacy `light` / `dark` normalization, and custom `custom:<id>` preferences without a migration.
- Do not add settings fields, backend handlers, schema changes, dependencies, remote fonts, or global CSS color transitions.
- Every built-in preset must continue defining every `themeTokenKeys` entry and pass `themeContrastPasses(validateThemeContrast(...))`.
- Keep reader typography and the custom reader canvas independent; “follow app theme” must inherit the revised application tokens naturally.
- Keep the picker’s `radiogroup` semantics, roving `tabindex`, keyboard arrows, focus outline, responsive single-column fallback, and localized existing copy.
- Use `apply_patch` for edits; preserve unrelated worktree changes and split commits by user-visible capability.

---

### Task 1: Lock and apply the four built-in palette contracts

**Files:**

- Modify: `frontend/src/utils/theme.test.ts`
- Modify: `frontend/cypress/e2e/theme-sidebar.cy.ts`
- Modify: `frontend/src/style.css`
- Modify: `frontend/src/utils/theme.ts`

**Interfaces:**

- Consumes: `presetTokens()`, `validateThemeContrast()`, `themeContrastPasses()`, and `themeBackgroundColors`.
- Produces: A CSS root block for each existing `BuiltInThemePreset` whose visual anchors and document/body background agree.

- [x] **Step 1: Add failing palette and browser contracts**

Add `themeBackgroundColors` to the existing `theme.ts` import and add this test data after `presetIds` in `frontend/src/utils/theme.test.ts`:

```ts
const visualAnchors = {
  paper: {
    "bg-primary": "#f8fafc",
    "surface-rail": "#eef2f6",
    "surface-panel": "#f8fafc",
    "surface-selected": "#dbeafe",
    "text-primary": "#18212f",
    "text-secondary": "#475569",
    "text-tertiary": "#59697a",
    "accent-color": "#2563eb",
    "accent-text-color": "#1d4ed8",
    "accent-foreground": "#ffffff",
  },
  ink: {
    "bg-primary": "#15181d",
    "surface-rail": "#11151a",
    "surface-panel": "#191e25",
    "surface-selected": "#24384b",
    "text-primary": "#eef3f8",
    "text-secondary": "#bac5d1",
    "text-tertiary": "#93a1b0",
    "accent-color": "#69b7ff",
    "accent-text-color": "#8dcbff",
    "accent-foreground": "#0e1720",
  },
  sepia: {
    "bg-primary": "#f5f1ea",
    "surface-rail": "#e9e0d3",
    "surface-panel": "#f7f3ec",
    "surface-selected": "#ead8c5",
    "text-primary": "#2f2924",
    "text-secondary": "#61574e",
    "text-tertiary": "#6b6158",
    "accent-color": "#9a4d24",
    "accent-text-color": "#883f1b",
    "accent-foreground": "#ffffff",
  },
  "high-contrast": {
    "bg-primary": "#000000",
    "surface-rail": "#0a0a0a",
    "surface-panel": "#000000",
    "surface-selected": "#3d3500",
    "text-primary": "#ffffff",
    "text-secondary": "#f5f5f5",
    "text-tertiary": "#f5f5f5",
    "accent-color": "#ffe600",
    "accent-text-color": "#ffe600",
    "accent-foreground": "#000000",
  },
} as const satisfies Record<
  (typeof presetIds)[number],
  Partial<Record<ThemeTokenKey, string>>
>;
```

Add the behavior test inside `describe('theme preferences', ...)`:

```ts
it.each(presetIds)("matches the documented shell palette for %s", (preset) => {
  expect(presetTokens(preset)).toMatchObject(visualAnchors[preset]);
  expect(themeBackgroundColors[preset]).toBe(
    visualAnchors[preset]["bg-primary"],
  );
  expect(themeContrastPasses(validateThemeContrast(presetTokens(preset)))).toBe(
    true,
  );
});
```

In `frontend/cypress/e2e/theme-sidebar.cy.ts`, replace the loose four-color set
assertion with a `Record` of expected computed CSS colors and assert the core
rail, panel, secondary-text, and accent-text tokens for every preset:

```ts
const expectedTokens = {
  paper: {
    "--surface-rail": "rgb(238, 242, 246)",
    "--surface-panel": "rgb(248, 250, 252)",
    "--text-secondary": "rgb(71, 85, 105)",
    "--accent-text-color": "rgb(29, 78, 216)",
  },
  ink: {
    "--surface-rail": "rgb(17, 21, 26)",
    "--surface-panel": "rgb(25, 30, 37)",
    "--text-secondary": "rgb(186, 197, 209)",
    "--accent-text-color": "rgb(141, 203, 255)",
  },
  sepia: {
    "--surface-rail": "rgb(233, 224, 211)",
    "--surface-panel": "rgb(247, 243, 236)",
    "--text-secondary": "rgb(97, 87, 78)",
    "--accent-text-color": "rgb(136, 63, 27)",
  },
  "high-contrast": {
    "--surface-rail": "rgb(10, 10, 10)",
    "--surface-panel": "rgb(0, 0, 0)",
    "--text-secondary": "rgb(245, 245, 245)",
    "--accent-text-color": "rgb(255, 230, 0)",
  },
} as const;

for (const [preset, tokens] of Object.entries(expectedTokens)) {
  root.dataset.themePreset = preset;
  for (const [token, expected] of Object.entries(tokens)) {
    expect(resolveTokenColor(token)).to.equal(expected);
  }
}
```

- [x] **Step 2: Run the focused contracts and verify the unit contract is red**

Run:

```bash
cd frontend
npm run test:unit -- src/utils/theme.test.ts
npm run test:e2e:spec -- cypress/e2e/theme-sidebar.cy.ts
```

Expected: the Vitest palette assertion fails on the old Paper anchors. If the
local Cypress binary remains unavailable, record that environment limitation
without installing it; the same token checks will be exercised by the installed
browser probe after implementation.

- [x] **Step 3: Apply the cohesive root token palette**

Update the shell anchors in the four `:root` preset blocks in
`frontend/src/style.css` to these exact values; retain all existing state,
syntax, media, shadow, and overlay token declarations so every preset remains
complete:

```css
/* Paper */
--bg-primary: #f8fafc;
--bg-secondary: #f1f5f9;
--bg-tertiary: #e5ebf2;
--surface-rail: #eef2f6;
--surface-panel: #f8fafc;
--surface-hover: #e8eef5;
--surface-selected: #dbeafe;
--text-primary: #18212f;
--text-secondary: #475569;
--text-tertiary: #59697a;
--accent-color: #2563eb;
--accent-hover: #1d4ed8;
--accent-text-color: #1d4ed8;
--accent-rgb: 37 99 235;
--border-color: #cbd5e1;
--code-bg-color: #f1f5f9;
--code-border-color: #cbd5e1;

/* Ink */
--bg-primary: #15181d;
--bg-secondary: #1c2229;
--bg-tertiary: #28313b;
--surface-rail: #11151a;
--surface-panel: #191e25;
--surface-hover: #27303a;
--surface-selected: #24384b;
--text-primary: #eef3f8;
--text-secondary: #bac5d1;
--text-tertiary: #93a1b0;
--accent-color: #69b7ff;
--accent-hover: #9bd4ff;
--accent-text-color: #8dcbff;
--accent-rgb: 105 183 255;
--accent-foreground: #0e1720;
--border-color: #3e4955;
--code-bg-color: #10151b;
--code-border-color: #3e4955;

/* Sepia */
--bg-primary: #f5f1ea;
--bg-secondary: #eee8de;
--bg-tertiary: #e4dbcf;
--surface-rail: #e9e0d3;
--surface-panel: #f7f3ec;
--surface-hover: #e6ddd1;
--surface-selected: #ead8c5;
--text-primary: #2f2924;
--text-secondary: #61574e;
--text-tertiary: #6b6158;
--accent-color: #9a4d24;
--accent-hover: #7d3d1d;
--accent-text-color: #883f1b;
--accent-rgb: 154 77 36;
--border-color: #cdbda9;
--code-bg-color: #eee5da;
--code-border-color: #cdbda9;

/* High Contrast */
--bg-secondary: #0a0a0a;
--bg-tertiary: #292929;
--surface-rail: #0a0a0a;
--surface-hover: #292929;
--surface-selected: #3d3500;
--text-secondary: #f5f5f5;
--text-tertiary: #f5f5f5;
```

Keep each preset’s selection colors consistent with its accent foreground:
Paper, Ink, and Sepia use their respective accent color plus current
accent foreground; High Contrast stays yellow on black. Then synchronize
`themeBackgroundColors` in `frontend/src/utils/theme.ts` with the four
`--bg-primary` values:

```ts
export const themeBackgroundColors: Record<ThemePreset, string> = {
  paper: "#f8fafc",
  ink: "#15181d",
  sepia: "#f5f1ea",
  "high-contrast": "#000000",
};
```

- [x] **Step 4: Verify the palette, contrast, and shell application**

Run:

```bash
cd frontend
npm run test:unit -- src/utils/theme.test.ts
npm run test:e2e:spec -- cypress/e2e/theme-sidebar.cy.ts
npx eslint src/utils/theme.ts src/utils/theme.test.ts
npx prettier --check src/style.css src/utils/theme.ts src/utils/theme.test.ts cypress/e2e/theme-sidebar.cy.ts
```

Expected: the focused Vitest suite passes, each complete preset passes the
existing contrast report, and the Cypress flow passes when its locally
installed application binary is available. Otherwise verify the same
`expectedTokens` in an installed-browser probe at runtime and record the
Cypress binary absence.

- [x] **Step 5: Commit the palette contract**

```bash
git add frontend/src/style.css frontend/src/utils/theme.ts frontend/src/utils/theme.test.ts frontend/cypress/e2e/theme-sidebar.cy.ts
git commit -m "feat(theme): refine built-in visual palette"
```

### Task 2: Replace stripe swatches with application-shell previews

**Files:**

- Modify: `frontend/src/components/settings/ThemePresetPicker.test.ts`
- Modify: `frontend/src/components/settings/ThemePresetPicker.vue`

**Interfaces:**

- Consumes: existing `ThemeOption.value`, `CustomThemeProfile.basePreset`, radio selection state, and the four stable `BuiltInThemePreset` IDs.
- Produces: `ThemeOption.previewPresets: readonly BuiltInThemePreset[]` and one or two `data-theme-preview-shell` miniature application-shell previews per option.

- [x] **Step 1: Add a failing semantic-preview test**

Add this test to `ThemePresetPicker.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const themePickerSource = readFileSync(
  resolve(process.cwd(), "src/components/settings/ThemePresetPicker.vue"),
  "utf8",
);

it("renders application-shell previews and shows both system bases for Auto", () => {
  const wrapper = mountPicker("auto", [focusProfile]);
  const autoPreview = wrapper.get(
    '[data-theme-option="auto"] .theme-preset-preview',
  );

  expect(autoPreview.findAll("[data-theme-preview-shell]")).toHaveLength(2);
  expect(
    autoPreview
      .findAll("[data-theme-preview-shell]")
      .map((shell) => shell.attributes("data-theme-preview-shell")),
  ).toEqual(["paper", "ink"]);
  expect(autoPreview.findAll(".theme-preset-preview-rail")).toHaveLength(2);
  expect(autoPreview.findAll(".theme-preset-preview-content")).toHaveLength(2);
  expect(autoPreview.findAll(".theme-preset-preview-active")).toHaveLength(2);

  const paperPreview = wrapper.get(
    '[data-theme-option="paper"] .theme-preset-preview',
  );
  expect(paperPreview.findAll("[data-theme-preview-shell]")).toHaveLength(1);
  expect(paperPreview.get('[data-theme-preview-shell="paper"]').exists()).toBe(
    true,
  );
  expect(
    wrapper
      .get(
        '[data-theme-option="custom:focus"] [data-theme-preview-shell="paper"]',
      )
      .exists(),
  ).toBe(true);
  expect(wrapper.find(".theme-preset-preview-surface").exists()).toBe(false);
});
```

Also add a source-level test that reads `ThemePresetPicker.vue` and asserts
the reduced-motion rule disables the option transition:

```ts
expect(themePickerSource).toMatch(
  /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.theme-preset-option\s*\{[\s\S]*?transition:\s*none;/,
);
```

- [x] **Step 2: Run the picker test to verify it fails**

Run:

```bash
cd frontend
npm run test:unit -- src/components/settings/ThemePresetPicker.test.ts
```

Expected: the existing three-stripe markup has no
`data-theme-preview-shell` elements and no reduced-motion transition rule.

- [x] **Step 3: Implement truthful miniature shell previews**

Replace `ThemeOption.previewPreset` with:

```ts
previewPresets: readonly BuiltInThemePreset[];
```

Set the option metadata exactly as follows:

```ts
{ value: 'auto', /* existing label and description */, previewPresets: ['paper', 'ink'] }
{ value: 'paper', /* existing label and description */, previewPresets: ['paper'] }
{ value: 'ink', /* existing label and description */, previewPresets: ['ink'] }
{ value: 'sepia', /* existing label and description */, previewPresets: ['sepia'] }
{ value: 'high-contrast', /* existing label and description */, previewPresets: ['high-contrast'] }
// Every custom profile uses previewPresets: [profile.basePreset].
```

Keep the existing option-level `data-theme-preview` attribute using the first
preview preset for compatibility, then replace the three stripe children with:

```vue
<span
  class="theme-preset-preview"
  :class="{ 'is-adaptive': option.previewPresets.length > 1 }"
  aria-hidden="true"
>
  <span
    v-for="preset in option.previewPresets"
    :key="preset"
    class="theme-preset-preview-shell"
    :data-theme-preview-shell="preset"
  >
    <span class="theme-preset-preview-rail">
      <span class="theme-preset-preview-active"></span>
    </span>
    <span class="theme-preset-preview-content">
      <span class="theme-preset-preview-heading"></span>
      <span class="theme-preset-preview-line"></span>
      <span class="theme-preset-preview-line is-short"></span>
      <span class="theme-preset-preview-action"></span>
    </span>
  </span>
</span>
```

Define preview-only custom properties on each
`.theme-preset-preview-shell[data-theme-preview-shell='…']` selector using
the exact Task 1 anchors. Each shell uses a two-column grid for rail/content,
an in-rail active rectangle, neutral heading/line marks, and one small
accent action rectangle. Use the following values for the per-theme preview
variables:

```css
/* --preview-canvas, --preview-rail, --preview-selected, --preview-copy, --preview-muted, --preview-accent */
paper: #f8fafc, #eef2f6, #dbeafe, #18212f, #59697a, #2563eb;
ink: #15181d, #11151a, #24384b, #eef3f8, #93a1b0, #69b7ff;
sepia: #f5f1ea, #e9e0d3, #ead8c5, #2f2924, #6b6158, #9a4d24;
high-contrast: #000000, #0a0a0a, #3d3500, #ffffff, #f5f5f5, #ffe600;
```

Keep previews compact (`2.5rem × 2rem` for one shell), make Auto a two-shell
row, retain the existing two-column picker and narrow-screen one-column
fallback, and add:

```css
@media (prefers-reduced-motion: reduce) {
  .theme-preset-option {
    transition: none;
  }
}
```

- [x] **Step 4: Verify preview semantics, keyboard behavior, and formatting**

Run:

```bash
cd frontend
npm run test:unit -- src/components/settings/ThemePresetPicker.test.ts
npx eslint src/components/settings/ThemePresetPicker.vue src/components/settings/ThemePresetPicker.test.ts
npx prettier --check src/components/settings/ThemePresetPicker.vue src/components/settings/ThemePresetPicker.test.ts
```

Expected: all existing radio-group navigation tests plus the new dual-Auto and
semantic-shell tests pass; no old stripe element remains.

- [x] **Step 5: Commit the picker refinement**

```bash
git add frontend/src/components/settings/ThemePresetPicker.vue frontend/src/components/settings/ThemePresetPicker.test.ts
git commit -m "feat(settings): preview built-in theme environments"
```

### Task 3: Run end-to-end verification and record the result

**Files:**

- Modify: `docs/superpowers/specs/2026-08-25-built-in-theme-refinement-design.md`
- Modify: `docs/superpowers/plans/2026-08-25-built-in-theme-refinement.md`

**Interfaces:**

- Consumes: the palette contract, picker semantics, existing `theme-sidebar` browser fixture, and `wails3 build`.
- Produces: a concise verification record and completed plan checkboxes without modifying persistence behavior.

- [x] **Step 1: Run complete automated verification**

Run:

```bash
cd frontend
npx vitest run --reporter=dot
npx eslint src
npx eslint --no-ignore cypress/e2e/theme-sidebar.cy.ts
npx prettier --check src cypress/e2e/theme-sidebar.cy.ts
npm run build
cd ..
git diff --check
wails3 build
```

Expected: all commands exit zero. Record only pre-existing jsdom canvas,
Vite configuration, bundle-size, Node engine, Husky, or platform linker
warnings separately from regressions.

- [x] **Step 2: Verify the visual contracts in a browser**

Run the existing Cypress spec if its binary is installed:

```bash
cd frontend
npm run test:e2e:spec -- cypress/e2e/theme-sidebar.cy.ts
```

At 1440px and 390px, inspect Paper, Ink, Sepia, and High Contrast. Confirm
that the shell colors match the Task 1 tokens; the picker shows a miniature
rail/content hierarchy; Auto shows both Paper and Ink; keyboard focus has a
visible outline; individual readers retain the existing custom-canvas boundary;
and no preview, rail, drawer, or settings control overflows. If Cypress is
unavailable locally, use the installed-browser probe to cover the same values
and record the missing binary without downloading it.

- [x] **Step 3: Update documentation and commit the verification record**

Append the exact commands, test totals, browser result, and any known
environment-only warnings to the specification. Mark every completed checkbox
in this plan. Then run:

```bash
git add docs/superpowers/specs/2026-08-25-built-in-theme-refinement-design.md docs/superpowers/plans/2026-08-25-built-in-theme-refinement.md
git commit -m "docs(theme): record refinement verification"
```
