# App Shell UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize every application Header, button size, and UI typography role so the desktop shell aligns on a shared border baseline in every theme.

**Architecture:** Define global semantic CSS primitives in `frontend/src/style.css`, then migrate component templates away from locally owned padding, height, and `.btn-*` rules. Existing Vue events, slots, i18n keys, reader-body typography, and theme tokens stay intact; source/component regression tests protect the new geometry contract.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Tailwind CSS v4, Vitest, Vue Test Utils, Vite, Wails v3.

## Global Constraints

- Cover main panes, reader link previews, image gallery, drawers, common modals, settings modal, dialogs, settings actions, and secondary application chrome.
- Do not change APIs, stores, settings schema, translations, navigation/state behavior, article reader body typography, or reader typography preferences.
- Use only existing semantic theme variables; do not add hard-coded palette values or theme migrations.
- Use `56px` desktop / `52px` narrow panel Headers, `64px` desktop / `56px` narrow modal Headers, `36px` desktop / `44px` touch controls, and `32px` desktop / `36px` touch compact controls.
- Preserve every existing `title`, `aria-*` attribute, focus restoration path, `data-testid`, `data-action`, and loading/disabled rule.
- Do not install dependencies. Use `apply_patch`, keep unrelated changes intact, and finish with `git diff --check`.

---

## File Structure

| File(s) | Responsibility |
| --- | --- |
| `frontend/src/style.css` | Shared Header, button, title, responsive, focus, and disabled primitives. |
| `frontend/src/components/common/AppShellStyleContracts.test.ts` | Source-level visual contract for global primitives and all migrated Header owners. |
| `frontend/src/components/article/{ArticleList,ArticleToolbar,ArticleDetail,ArticleDetailModal}.vue` | Article top bars and reader-link preview Headers. |
| `frontend/src/components/article/imageGallery/components/ImageGalleryHeader.vue` | Image gallery Header and actions. |
| `frontend/src/components/sidebar/FeedList.vue` | Drawer Header and icon controls. |
| `frontend/src/components/common/{BaseModal,ModalFooter}.vue`, `frontend/src/components/modals/SettingsModal.vue` | Common modal framing and footer controls. |
| `frontend/src/components/modals/{discovery,filter,rules,update}/**/*.vue` | Dialog Header/title/action migration. |
| `frontend/src/components/modals/settings/**/*.vue`, `frontend/src/components/settings/**/*.vue` | Settings button migration and hierarchy roles. |
| Existing focused tests | Retain accessibility, interaction, and responsive target coverage. |

### Task 1: Add shared shell primitives and their failing contract

**Files:**
- Create: `frontend/src/components/common/AppShellStyleContracts.test.ts`
- Modify: `frontend/src/style.css`

**Interfaces:**
- Produces global classes `app-panel-header`, `app-modal-header`, `ui-page-title`, `ui-modal-title`, `ui-section-title`, `ui-button`, `ui-button--primary`, `ui-button--secondary`, `ui-button--danger`, `ui-button--ghost`, `ui-button--compact`, `ui-icon-button`, and `ui-icon-button--danger`.
- Consumed by every later task; no Vue runtime interface changes.

- [ ] **Step 1: Write the failing style contract.**

Create `AppShellStyleContracts.test.ts` using the repository’s existing `readFileSync` source-test pattern:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const styleSource = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');

describe('app shell style primitives', () => {
  it('defines fixed header geometry with one border owner', () => {
    expect(styleSource).toContain('--app-panel-header-height: 56px;');
    expect(styleSource).toContain('--app-modal-header-height: 64px;');
    expect(styleSource).toMatch(/\.app-panel-header\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?height:\s*var\(--app-panel-header-height\);[\s\S]*?border-bottom:\s*1px solid var\(--border-color\);/);
    expect(styleSource).toMatch(/\.app-modal-header\s*\{[\s\S]*?height:\s*var\(--app-modal-header-height\);[\s\S]*?border-bottom:\s*1px solid var\(--border-color\);/);
  });

  it('defines shared desktop and touch control geometry', () => {
    for (const name of ['ui-page-title', 'ui-modal-title', 'ui-section-title', 'ui-button', 'ui-button--primary', 'ui-button--secondary', 'ui-button--danger', 'ui-button--ghost', 'ui-button--compact', 'ui-icon-button', 'ui-icon-button--danger']) {
      expect(styleSource).toContain(`.${name}`);
    }
    expect(styleSource).toMatch(/\.ui-icon-button\s*\{[\s\S]*?width:\s*var\(--ui-control-height\);[\s\S]*?height:\s*var\(--ui-control-height\);/);
    expect(styleSource).toMatch(/@media \(max-width: 767px\)[\s\S]*?--ui-control-height:\s*44px;/);
  });
});
```

- [ ] **Step 2: Run the test before implementation.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts`

Expected: FAIL because the test file and global primitive classes do not yet exist.

- [ ] **Step 3: Add the minimal global primitive system.**

After the base layer in `style.css`, define this shape while retaining all existing global helpers:

```css
:root {
  --app-panel-header-height: 56px;
  --app-modal-header-height: 64px;
  --ui-control-height: 36px;
  --ui-control-compact-height: 32px;
}

.app-panel-header,
.app-modal-header {
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
}
.app-panel-header { height: var(--app-panel-header-height); padding-inline: 1rem; }
.app-modal-header { height: var(--app-modal-header-height); padding-inline: 1.25rem; }
.ui-button { box-sizing: border-box; display: inline-flex; min-height: var(--ui-control-height); align-items: center; justify-content: center; gap: 0.5rem; padding-inline: 0.875rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; }
.ui-icon-button { width: var(--ui-control-height); height: var(--ui-control-height); flex: 0 0 var(--ui-control-height); padding: 0; }
```

Add title roles, primary/secondary/danger/ghost color variants, disabled state, focus-visible treatment, and compact sizing using only existing `--bg-*`, `--text-*`, `--accent-*`, and `--state-danger-*` variables. In `@media (max-width: 767px)`, set panel/modal heights to `52px`/`56px`, control height to `44px`, and compact height to `36px`.

- [ ] **Step 4: Re-run the focused test and formatting check.**

Run:

```bash
cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts
npx prettier --check src/style.css src/components/common/AppShellStyleContracts.test.ts
```

Expected: PASS; the shared primitives and responsive dimensions are provably present.

- [ ] **Step 5: Commit the foundation.**

```bash
git add frontend/src/style.css frontend/src/components/common/AppShellStyleContracts.test.ts
git commit -m "style(ui): add shared shell primitives"
```

### Task 2: Align primary-pane and reader-preview Headers

**Files:**
- Modify: `frontend/src/components/article/ArticleList.vue`
- Modify: `frontend/src/components/article/ArticleToolbar.vue`
- Modify: `frontend/src/components/article/ArticleDetail.vue`
- Modify: `frontend/src/components/article/ArticleDetailModal.vue`
- Modify: `frontend/src/components/article/imageGallery/components/ImageGalleryHeader.vue`
- Modify: `frontend/src/components/sidebar/FeedList.vue`
- Modify: `frontend/src/components/article/ArticleList.test.ts`
- Modify: `frontend/src/components/article/ArticleToolbar.test.ts`
- Modify: `frontend/src/components/sidebar/SidebarNavigation.test.ts`
- Modify: `frontend/src/components/common/AppShellStyleContracts.test.ts`

**Interfaces:**
- Consumes Task 1 classes.
- Preserves article events, drawer `data-action` values, reader-link preview IDs, and sidebar auto-hide behavior.
- Produces a shared `56px` desktop baseline across article list, article toolbar, gallery, and drawer.

- [ ] **Step 1: Add failing header-migration assertions.**

Append this to `AppShellStyleContracts.test.ts`:

```ts
const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

it('uses panel headers and shared actions in every primary pane', () => {
  for (const file of [
    'src/components/article/ArticleList.vue',
    'src/components/article/ArticleToolbar.vue',
    'src/components/article/imageGallery/components/ImageGalleryHeader.vue',
    'src/components/sidebar/FeedList.vue',
  ]) {
    expect(source(file)).toContain('app-panel-header');
    expect(source(file)).toContain('ui-icon-button');
  }
  expect(source('src/components/article/ArticleDetail.vue')).toContain('app-panel-header');
  expect(source('src/components/article/ArticleDetailModal.vue')).toContain('app-panel-header');
});
```

Add component assertions that ArticleList header actions and ArticleToolbar action buttons contain `ui-icon-button`, while retaining their current ARIA/test-id assertions. Change sidebar source assertions from private `.drawer-icon-button` dimensions to the shared class usage.

- [ ] **Step 2: Run the focused pane tests before migration.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts src/components/article/ArticleList.test.ts src/components/article/ArticleToolbar.test.ts src/components/sidebar/SidebarNavigation.test.ts`

Expected: FAIL because current components own `p-*` Header geometry and local icon control sizing.

- [ ] **Step 3: Migrate all primary top bars.**

Use these exact semantic substitutions without changing conditions or handlers:

```vue
<div class="app-panel-header">
  <h2 class="ui-page-title">...</h2>
  <button class="ui-icon-button ui-button--ghost" ...>...</button>
</div>

<div class="article-toolbar app-panel-header" :class="{ 'is-reading-mode': isReadingMode }">
  <button class="ui-button ui-button--ghost" ...>...</button>
  <button class="ui-icon-button ui-button--ghost" ...>...</button>
</div>

<header class="app-panel-header">
  <button class="ui-button ui-button--ghost" ...>...</button>
</header>
```

Apply the first pattern to ArticleList and ImageGalleryHeader, the second to ArticleToolbar, and the third to reader-link previews in ArticleDetail and ArticleDetailModal. Replace FeedList drawer pin/close/search/edit/save controls with `ui-icon-button` plus ghost/danger variant. Remove obsolete `.action-btn` and `.drawer-icon-button` geometry only after all references have moved. Keep toolbar scrolling, reading progress, and appearance-panel behavior unchanged.

- [ ] **Step 4: Re-run focused pane tests.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts src/components/article/ArticleList.test.ts src/components/article/ArticleToolbar.test.ts src/components/sidebar/SidebarNavigation.test.ts`

Expected: PASS; accessibility and auto-hide contracts remain green.

- [ ] **Step 5: Commit the primary-shell migration.**

```bash
git add frontend/src/components/article/ArticleList.vue frontend/src/components/article/ArticleToolbar.vue frontend/src/components/article/ArticleDetail.vue frontend/src/components/article/ArticleDetailModal.vue frontend/src/components/article/imageGallery/components/ImageGalleryHeader.vue frontend/src/components/sidebar/FeedList.vue frontend/src/components/article/ArticleList.test.ts frontend/src/components/article/ArticleToolbar.test.ts frontend/src/components/sidebar/SidebarNavigation.test.ts frontend/src/components/common/AppShellStyleContracts.test.ts
git commit -m "style(ui): align primary pane headers"
```

### Task 3: Normalize modal framing, Header slots, and footer actions

**Files:**
- Modify: `frontend/src/components/common/BaseModal.vue`
- Modify: `frontend/src/components/common/ModalFooter.vue`
- Modify: `frontend/src/components/modals/SettingsModal.vue`
- Modify: `frontend/src/components/modals/discovery/{DiscoverFeedsModal,DiscoverAllFeedsModal}.vue`
- Modify: `frontend/src/components/modals/filter/{ArticleFilterModal,SavedFilterModal}.vue`
- Modify: `frontend/src/components/modals/rules/RuleEditorModal.vue`
- Modify: `frontend/src/components/modals/update/UpdateAvailableDialog.vue`
- Modify: `frontend/src/components/modals/update/UpdateAvailableDialog.test.ts`
- Modify: `frontend/src/components/common/AppShellStyleContracts.test.ts`

**Interfaces:**
- Consumes Task 1 `app-modal-header`, title roles, and button primitives.
- Preserves BaseModal props/slots, ModalFooter `ButtonAction`, z-indexes, close events, and update-dialog keyboard behavior.
- Produces a single border owner for default and slotted modal Headers.

- [ ] **Step 1: Add failing modal contract tests.**

Add:

```ts
it('uses modal headers for common, settings, and discovery dialogs', () => {
  for (const file of [
    'src/components/common/BaseModal.vue',
    'src/components/modals/SettingsModal.vue',
    'src/components/modals/discovery/DiscoverFeedsModal.vue',
    'src/components/modals/discovery/DiscoverAllFeedsModal.vue',
  ]) expect(source(file)).toContain('app-modal-header');
  expect(source('src/components/common/ModalFooter.vue')).toContain('ui-button');
});
```

Add an update-dialog assertion for `ui-modal-title` and for its unchanged disabled primary action.

- [ ] **Step 2: Run dialog tests before implementation.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts src/components/modals/update/UpdateAvailableDialog.test.ts`

Expected: FAIL because BaseModal/SettingsModal own `p-3 sm:p-5` geometry and ModalFooter owns independent padding/height utilities.

- [ ] **Step 3: Move modal geometry to the shared system.**

Make BaseModal’s wrapper use `['app-modal-header', headerClass]`, its default title `ui-modal-title`, and its close control `ui-icon-button ui-button--ghost`. Apply `app-modal-header` to SettingsModal. In both discovery Header slots, remove negative margin/vertical-padding compensation; retain gradient background in a full-height slot wrapper, use `ui-modal-title`, and use a shared close icon button. Make `ModalFooter.getButtonClasses()` return `ui-button` plus the shared color variant rather than local padding/height tokens. Migrate filter, saved-filter, rule, and update Header/action classes and delete their local `.btn-*` declarations when they only own common geometry.

- [ ] **Step 4: Re-run dialog and interaction tests.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts src/components/modals/update/UpdateAvailableDialog.test.ts src/components/article/ArticleDetailModal.test.ts`

Expected: PASS; close, Enter/Escape, and modal classes behave as before.

- [ ] **Step 5: Commit the modal migration.**

```bash
git add frontend/src/components/common/BaseModal.vue frontend/src/components/common/ModalFooter.vue frontend/src/components/modals/SettingsModal.vue frontend/src/components/modals/discovery frontend/src/components/modals/filter frontend/src/components/modals/rules/RuleEditorModal.vue frontend/src/components/modals/update frontend/src/components/common/AppShellStyleContracts.test.ts
git commit -m "style(ui): unify modal headers and actions"
```

### Task 4: Migrate all settings and feature action variants

**Files:**
- Modify: `frontend/src/components/settings/styles.css`
- Modify: `frontend/src/components/settings/base/{SettingControl/ButtonControl,StatusBoxGroup}.vue`
- Modify: `frontend/src/components/modals/settings/{about,ai,content,general,plugins,reading,tags}/**/*.vue`
- Modify: `frontend/src/components/article/{ArticleContent}.vue`
- Modify: `frontend/src/components/article/parts/ArticleBody.vue`
- Modify: `frontend/src/components/modals/rules/{RuleAction,RuleConditionItem}.vue`
- Modify: `frontend/src/components/settings/base/SettingControl/NumberControl.test.ts`
- Modify: `frontend/src/components/modals/settings/reading/CustomizationSettings.test.ts`
- Modify: `frontend/src/components/common/AppShellStyleContracts.test.ts`

**Interfaces:**
- Consumes global shared variants.
- Keeps `ButtonControl` props (`label`, `icon`, `type`, `disabled`, `loading`) and `click` event exactly as-is.
- Keeps each feature handler, spinner, disabled state, and localized label unchanged.

- [ ] **Step 1: Add failing no-private-geometry assertions.**

Add:

```ts
it('keeps shared button geometry out of feature-local btn rules', () => {
  for (const file of [
    'src/components/settings/styles.css',
    'src/components/settings/base/SettingControl/ButtonControl.vue',
    'src/components/modals/settings/about/AboutTab.vue',
    'src/components/modals/settings/plugins/FreshRSSSettings.vue',
    'src/components/modals/settings/plugins/RSSHubSettings.vue',
    'src/components/modals/rules/RuleAction.vue',
    'src/components/modals/rules/RuleConditionItem.vue',
  ]) {
    expect(source(file)).toContain('ui-button');
    expect(source(file)).not.toMatch(/\.btn-(primary|secondary|danger)\s*\{[\s\S]*?(padding|height|min-height|width)/);
  }
});
```

Extend `ButtonControl` coverage to assert its rendered button uses `ui-button`, selects a variant from `type`, and remains disabled while loading. Update CustomizationSettings selectors to assert the new semantic classes.

- [ ] **Step 2: Run targeted setting/action tests before migration.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts src/components/settings/base/SettingControl/NumberControl.test.ts src/components/modals/settings/reading/CustomizationSettings.test.ts`

Expected: FAIL because private button rules still define geometry and ButtonControl renders private `.btn-*` classes.

- [ ] **Step 3: Replace duplicated component geometry.**

Use only these structures for application actions:

```vue
<button class="ui-button ui-button--primary" ...>...</button>
<button class="ui-button ui-button--secondary" ...>...</button>
<button class="ui-button ui-button--danger" ...>...</button>
<button class="ui-icon-button ui-icon-button--danger" ...>...</button>
<button class="ui-button ui-button--secondary ui-button--compact" ...>...</button>
```

Migrate every local `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-danger-icon`, and `.btn-secondary-compact` owner listed above. Use compact only for rule rows, article continuation controls, and dense settings/table actions. Delete private common-geometry rules but retain feature-only layout and spinner rules. Make ButtonControl map its existing `type` prop to global variants instead of changing its external API.

- [ ] **Step 4: Re-run setting/action behavior tests.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts src/components/settings/base/SettingControl/NumberControl.test.ts src/components/modals/settings/reading/CustomizationSettings.test.ts src/components/settings/CustomThemeManager.test.ts`

Expected: PASS; disabled and click behavior is unchanged while geometry is global.

- [ ] **Step 5: Commit the action migration.**

```bash
git add frontend/src/components/settings frontend/src/components/modals/settings frontend/src/components/article/ArticleContent.vue frontend/src/components/article/parts/ArticleBody.vue frontend/src/components/modals/rules/RuleAction.vue frontend/src/components/modals/rules/RuleConditionItem.vue frontend/src/components/common/AppShellStyleContracts.test.ts
git commit -m "style(ui): normalize settings action controls"
```

### Task 5: Apply section hierarchy to secondary application chrome and verify

**Files:**
- Modify: `frontend/src/components/article/{AISearchBar,ArticleChatPanel,ReaderAppearancePanel}.vue`
- Modify: `frontend/src/components/article/parts/VideoPlayer.vue`
- Modify: `frontend/src/components/modals/common/MultiSelectDialog.vue`
- Modify: `frontend/src/components/modals/settings/feeds/FeedManagementSettings.vue`
- Modify: `frontend/src/components/settings/base/SettingGroup.vue`
- Modify: `frontend/src/components/article/ReaderAppearancePanel.test.ts`
- Modify: `frontend/src/components/common/AppShellStyleContracts.test.ts`

**Interfaces:**
- Consumes title, compact, and icon primitives.
- Keeps reader-appearance dialog ID, mobile focus trap, chat session behavior, feed-management grid, and media controls unchanged.
- Does not apply shared button styles inside article `.prose`, iframe contents, or site-supplied HTML.

- [ ] **Step 1: Add failing secondary-surface contracts.**

Add this test and extend ReaderAppearancePanel coverage:

```ts
it('uses shared hierarchy roles in secondary application surfaces', () => {
  for (const file of [
    'src/components/article/AISearchBar.vue',
    'src/components/article/ArticleChatPanel.vue',
    'src/components/article/ReaderAppearancePanel.vue',
    'src/components/modals/settings/feeds/FeedManagementSettings.vue',
  ]) expect(source(file)).toMatch(/ui-(section-title|icon-button|button--compact)/);
  expect(source('src/components/article/parts/VideoPlayer.vue')).toContain('ui-section-title');
});
```

Assert `reader-appearance-close`, `reader-font-decrease`, and `reader-font-increase` use `ui-icon-button` without weakening the current focus-trap assertions.

- [ ] **Step 2: Run secondary-surface tests before migration.**

Run: `cd frontend && npx vitest run src/components/common/AppShellStyleContracts.test.ts src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleContent.test.ts`

Expected: FAIL because those surfaces still use local padding-based action and heading styles.

- [ ] **Step 3: Migrate application chrome only.**

Use `ui-section-title` for chat, video, feed-management, and settings subgroup headings. Apply `ui-icon-button` to AI search clear, chat new/close, reader appearance close/font controls, and multi-select controls. Use `ui-button--compact` only for dense management rows. Preserve AI search input geometry, chat resize handle, native media controls, and article content controls.

- [ ] **Step 4: Run all frontend checks and desktop build.**

Run:

```bash
cd frontend && npm run test:unit
npx eslint .
npx prettier --check src
npm run build
cd .. && git diff --check
wails3 build
```

Expected: all commands exit 0. If an unrelated existing failure is found, report its exact command/output and do not weaken the newly added style contracts.

- [ ] **Step 5: Review responsive visual acceptance cases.**

At 1440px, 1024px, and 390px in Paper, Ink, Sepia, and High Contrast, verify that primary-pane borders are co-linear, modal borders are uninterrupted, Header icon controls share the correct size, type roles are distinct, and article-reader typography is unchanged.

- [ ] **Step 6: Commit the final hierarchy migration.**

```bash
git add frontend/src/components/article frontend/src/components/modals/common/MultiSelectDialog.vue frontend/src/components/modals/settings/feeds/FeedManagementSettings.vue frontend/src/components/settings/base/SettingGroup.vue frontend/src/components/article/ReaderAppearancePanel.test.ts frontend/src/components/common/AppShellStyleContracts.test.ts
git commit -m "style(ui): complete shell hierarchy alignment"
```

## Plan self-review

- **Spec coverage:** Task 1 implements global geometry, variants, roles, responsive sizing, focus, and disabled behavior. Task 2 covers all primary-pane and reader-preview borders. Task 3 covers common/settings/business dialogs. Task 4 removes duplicate action geometry throughout feature and settings components. Task 5 covers secondary chrome and visual/build validation. Article-body typography and behavior stay excluded.
- **Placeholder scan:** Every task contains file paths, exact class names, commands, expected test result, and an implementation snippet or direct migration instruction; there are no deferred implementation markers.
- **Type consistency:** All tasks consume the Task 1 class names. ButtonControl retains its current prop/event interface; BaseModal and ModalFooter retain their public props and slot contracts.
