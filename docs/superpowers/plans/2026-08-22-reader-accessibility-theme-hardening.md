# Reader Accessibility and Theme Hardening Implementation Plan

> **For agentic workers:** Execute this plan in the current workspace. Keep unrelated dirty worktree changes intact and verify each task before moving on.

**Goal:** Finish the reader's P1 theme and accessibility hardening so every built-in preset has semantic feedback and syntax colors, core text meets readable contrast, and shared controls expose accessible names.

**Architecture:** CSS variables remain the single theme source of truth. Shared Vue controls consume semantic classes backed by those variables. Component props carry accessible labels to the native input or icon button. Visual color contracts are validated with browser accessibility scans in addition to unit tests.

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS, Vitest, Vite, axe/browser automation.

## Constraints

- Preserve the existing `auto`, `paper`, `ink`, `sepia`, and `high-contrast` preference model.
- Do not revert or rewrite unrelated uncommitted reader work.
- Use i18n values for user-facing accessible names.
- Write behavior tests before changing component implementation.
- Keep UI density suitable for a feed reader; do not trade legibility for compactness.

### Task 1: Establish failing accessibility contracts

**Files:**

- Create: `frontend/src/components/settings/base/SettingWithToggle.test.ts`
- Create: `frontend/src/components/settings/base/SettingControl/NumberControl.test.ts`
- Modify: `frontend/src/components/article/ArticleToolbar.test.ts`

- [ ] Add a setting-with-toggle test that asserts its native checkbox is named from the setting title.
- [ ] Add a number-control test that passes `ariaLabel` and asserts the attribute is placed on the native number input rather than its wrapper.
- [ ] Extend the existing toolbar test to assert the mobile back action has a localized accessible name.
- [ ] Run the three focused test files and confirm they fail for the missing contracts before implementation.

### Task 2: Implement accessible control labels

**Files:**

- Modify: `frontend/src/components/settings/base/SettingWithToggle.vue`
- Modify: `frontend/src/components/settings/base/SettingControl/ToggleControl.vue`
- Modify: `frontend/src/components/settings/base/SettingControl/NumberControl.vue`
- Modify: direct `NumberControl` callers under `frontend/src/components/modals/settings/`
- Modify: `frontend/src/components/article/ArticleToolbar.vue`

- [ ] Add an `ariaLabel` prop to the low-level controls and bind it directly to their native inputs.
- [ ] Pass the setting title through `SettingWithToggle`.
- [ ] Supply localized labels to direct number-input uses.
- [ ] Name and title the mobile article back control.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Complete theme semantic tokens

**Files:**

- Modify: `frontend/src/style.css`
- Modify: `frontend/src/components/common/Toast.vue`
- Modify: shared settings/form controls that display validation or danger states
- Modify: `frontend/src/components/article/ArticleContent.css`

- [ ] Define foreground-on-accent, selection, feedback state, and syntax token families for all four fixed presets.
- [ ] Replace fixed state colors in shared feedback/form controls with semantic token-backed classes.
- [ ] Apply the code syntax tokens after the highlight.js base import for every preset.
- [ ] Use the accent foreground token for native checkbox styling and other core accent-on-text affordances.

### Task 4: Restore reading contrast without expanding density

**Files:**

- Modify: `frontend/src/components/article/ArticleItem.vue`
- Modify: `frontend/src/components/article/ArticleDetail.vue`

- [ ] Raise article metadata and author rendering to readable semantic text colors and a stable minimum text size.
- [ ] Remove low-opacity previous/next article navigation text.
- [ ] Replace the selected article's single-side indication with a whole-surface selection treatment.

### Task 5: Remove remote font/icon runtime dependencies

**Files:**

- Modify: `frontend/index.html`
- Modify: `frontend/src/style.css`
- Modify: `frontend/tailwind.config.js` only if its font stack still assumes remote font delivery

- [ ] Remove Google Fonts and unpkg icon network resources from the application shell.
- [ ] Retain a CJK-capable system font stack and local Phosphor Vue icon usage.
- [ ] Build the app to ensure no application code depended on the deleted resources.

### Task 6: Verify the completed reader surface

- [ ] Run focused and complete frontend unit tests.
- [ ] Run lint, format check, and Vite production build.
- [ ] Run browser axe scans for settings and mocked desktop/mobile article surfaces; validate the original label, button-name, and contrast violations are absent.
- [ ] Run the available backend/build validation and report any environment-only limitation, including missing Wails tooling.

## Plan Self-Review

- The plan has a direct failing test for each changed input/button accessibility contract.
- CSS-only contracts are validated through computed browser output and axe instead of brittle source-string tests.
- Every task identifies concrete files and preserves the existing reader architecture.
