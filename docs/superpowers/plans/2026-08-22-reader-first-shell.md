# Reader-First Adaptive Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Make MrRSS a reader-first adaptive RSS shell with coherent built-in themes, content-preserving tablet/mobile navigation, and a measured article reading column.

**Architecture:** Add a small `useResponsiveShell` composable that owns viewport classification, compact navigation state, Escape handling, and focus restoration. `App.vue` passes that state into the existing `Sidebar`, `ArticleList`, and image-gallery shell; the existing feed/filter/article data flow remains unchanged. Extend the current semantic theme tokens and apply them to the rail, feed drawer, navigation states, and reader surfaces. Keep the existing reading-mode implementation intact and layer the responsive shell around it.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Pinia, Tailwind CSS 4, Vitest, Vue Test Utils, agent-browser, Vite.

## Global Constraints

- Reading comes first: feed triage, article comprehension, and return-to-context remain the clearest path.
- Preserve current HTTP APIs, settings schema, feed hierarchy, saved filters, drag-and-drop, article actions, and existing reading-mode behavior.
- Use semantic theme tokens for reader-shell surfaces and interaction states; do not add theme-specific hard-coded colors to those surfaces.
- Maintain WCAG 2.1 AA: visible keyboard focus, accessible names/states, non-color state cues, and 44px primary touch targets.
- Honor `prefers-reduced-motion`; transitions may use transform/opacity only.
- Keep user-facing strings in `en.ts` and `zh.ts`; do not introduce literal UI copy in templates.
- Preserve unrelated dirty worktree changes and do not reset or checkout files.

## File Map

- Create `frontend/src/composables/ui/useResponsiveShell.ts`: viewport state, compact navigation state, Escape handling, and focus restoration.
- Create `frontend/src/composables/ui/useResponsiveShell.test.ts`: unit coverage for mobile defaults, toggling, Escape, focus restoration, and media changes.
- Modify `frontend/src/App.vue`: connect the responsive shell while preserving reading mode wrappers and existing event listeners.
- Modify `frontend/src/components/sidebar/Sidebar.vue`: render the rail/drawer as a responsive overlay, manage backdrop behavior, and close compact navigation after selection.
- Modify `frontend/src/components/sidebar/ActivityBar.vue`: semantic labels/states, tokenized selected surfaces, stable 44px targets, and reduced-motion handling.
- Modify `frontend/src/components/sidebar/FeedList.vue`: compact selection close behavior, accessible search/controls, and tokenized drawer surfaces.
- Modify `frontend/src/components/sidebar/SidebarCategory.vue`, `SidebarFeed.vue`, and `SavedFilterItem.vue`: keyboard semantics and tokenized unread/warning states.
- Modify `frontend/src/components/article/ArticleList.vue`: accessible mobile navigation trigger and tokenized list header/filter states.
- Modify `frontend/src/components/article/ArticleToolbar.vue`: tokenized favorite/read-later states without altering the user’s existing reading-mode actions.
- Modify `frontend/src/style.css`: complete semantic surface/state tokens for every built-in preset, overlay tokens, and shared reduced-motion/focus rules.
- Modify `frontend/src/components/article/ArticleContent.vue`, `ArticleContent.css`, `ArticleTitle.vue`, and `ArticleSummary.vue`: measured reading column and responsive spacing while honoring content settings.

### Task 1: Add Responsive Shell State

**Files:**
- Create: `frontend/src/composables/ui/useResponsiveShell.ts`
- Test: `frontend/src/composables/ui/useResponsiveShell.test.ts`

**Interfaces:**
- Produces `isCompactViewport: Readonly<Ref<boolean>>` for widths below 1280px.
- Produces `isMobileViewport: Readonly<Ref<boolean>>` for widths below 768px.
- Produces `isNavigationOpen: Ref<boolean>`, `openNavigation()`, `closeNavigation()`, and `toggleNavigation()`.

- [ ] **Step 1: Write the failing tests**

```ts
it('starts closed on mobile and open on desktop', () => {
  mockMedia({ '(max-width: 1279px)': true, '(max-width: 767px)': true });
  const state = mountResponsiveShell();
  expect(state.isCompactViewport.value).toBe(true);
  expect(state.isMobileViewport.value).toBe(true);
  expect(state.isNavigationOpen.value).toBe(false);
});

it('closes on Escape and returns focus to the navigation trigger', async () => {
  mockMedia({ '(max-width: 1279px)': true, '(max-width: 767px)': true });
  const trigger = document.createElement('button');
  trigger.dataset.responsiveNavTrigger = 'true';
  document.body.append(trigger);
  const state = mountResponsiveShell();
  state.openNavigation();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await nextTick();
  expect(state.isNavigationOpen.value).toBe(false);
  expect(document.activeElement).toBe(trigger);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test:unit -- src/composables/ui/useResponsiveShell.test.ts`

Expected: FAIL because the composable and its exported state do not exist.

- [ ] **Step 3: Implement the minimal composable**

Use `window.matchMedia` for the two breakpoints, initialize mobile navigation
closed, subscribe with `addEventListener('change', ...)` (falling back to
`addListener` for older WebViews), and remove listeners in `onBeforeUnmount`.
`closeNavigation()` must set the ref to false and focus
`[data-responsive-nav-trigger]` on the next animation frame. The keydown handler
only intercepts Escape while the mobile overlay is open.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm run test:unit -- src/composables/ui/useResponsiveShell.test.ts`

Expected: all responsive-shell tests pass.

- [ ] **Step 5: Commit only the task files**

```bash
git add frontend/src/composables/ui/useResponsiveShell.ts frontend/src/composables/ui/useResponsiveShell.test.ts
git commit -m "feat: add responsive reader shell state"
```

### Task 2: Connect App and Sidebar Overlay Layout

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/components/sidebar/Sidebar.vue`
- Test: `frontend/src/App.test.ts` (add responsive prop/state assertions without removing existing reading-mode assertions)

**Interfaces:**
- `Sidebar` accepts `is-compact?: boolean` and `is-mobile?: boolean` in addition to its current `is-open` prop.
- `App` derives `isSidebarOpen` as `!isMobileViewport || isNavigationOpen` so desktop/tablet layout remains present while mobile starts closed.

- [ ] **Step 1: Add the failing App assertions**

```ts
it('passes compact navigation state to the sidebar and article list', async () => {
  mockMobileViewport();
  const wrapper = mountAppWithStubs();
  await nextTick();
  expect(wrapper.findComponent({ name: 'Sidebar' }).props('isMobile')).toBe(true);
  expect(wrapper.findComponent({ name: 'ArticleList' }).props('isSidebarOpen')).toBe(false);
});
```

- [ ] **Step 2: Run the App test and verify it fails**

Run: `npm run test:unit -- src/App.test.ts`

Expected: FAIL because App does not yet pass the responsive props.

- [ ] **Step 3: Wire the composable into App without disturbing reading mode**

Import `useResponsiveShell`, replace the standalone `isSidebarOpen` ref with a
computed value, keep the existing `store.isReadingMode` watcher and wrappers, and
pass `is-compact`/`is-mobile` to `Sidebar`. `toggleSidebar()` delegates to
`toggleNavigation()`. Image gallery and ArticleList continue receiving the derived
open value.

- [ ] **Step 4: Add Sidebar overlay behavior**

Add a backdrop button with an accessible label. On mobile it closes the whole
navigation; on tablet it collapses only the feed drawer. Force the mobile feed
drawer open when the navigation overlay opens so the user sees sources immediately.
Keep desktop pinned behavior unchanged. Add `aria-hidden` while the mobile shell is
closed and return focus through the composable trigger selector.

- [ ] **Step 5: Add responsive CSS**

At 768-1279px force a pinned feed drawer to absolute overlay positioning while the
rail keeps its width. Below 768px make the Sidebar fixed, full-viewport, off-canvas
when closed, and full overlay when open; keep the rail at 44px and the drawer at
`min(300px, calc(100vw - 44px))`. Use a tokenized backdrop and transform/opacity
transitions only.

- [ ] **Step 6: Run App and sidebar-focused tests**

Run: `npm run test:unit -- src/App.test.ts src/composables/ui/useResponsiveShell.test.ts`

Expected: all tests pass, including existing reading-mode checks.

### Task 3: Make Navigation and Feed Selection Semantic

**Files:**
- Modify: `frontend/src/components/sidebar/ActivityBar.vue`
- Modify: `frontend/src/components/sidebar/FeedList.vue`
- Modify: `frontend/src/components/sidebar/SidebarCategory.vue`
- Modify: `frontend/src/components/sidebar/SidebarFeed.vue`
- Modify: `frontend/src/components/sidebar/SavedFilterItem.vue`

**Interfaces:**
- Existing selection, drag/drop, context-menu, pin, and saved-filter events remain unchanged.
- `FeedList` accepts `is-mobile?: boolean`; compact selection emits its existing collapse path so Sidebar closes the overlay.

- [ ] **Step 1: Add semantic interaction tests where supported**

Assert that the activity buttons expose `aria-label`/`aria-current`, the feed search
has a label, and category/feed items expose keyboard focus and selected state. Keep
drag-and-drop event behavior unchanged.

- [ ] **Step 2: Run the focused component tests and verify the new assertions fail**

Run: `npm run test:unit -- src/components/sidebar`

Expected: FAIL on the new semantics until the templates are updated.

- [ ] **Step 3: Implement ActivityBar semantics and stable targets**

Add nav landmark labeling, `aria-label`, `aria-current="page"`, and
`aria-expanded`/`aria-controls` to controls. Replace the 36px mobile override with
44px targets. Use tokenized rail/hover/selected surfaces and the unread badge.

- [ ] **Step 4: Implement FeedList compact close and labels**

Label the search input and icon-only controls, mark the drawer close control with
`data-responsive-nav-close`, pass `is-mobile` to selection logic, and collapse the
drawer after mobile feed/category/filter selection. Replace hard-coded scrollbar
colors with semantic tokens.

- [ ] **Step 5: Implement category/feed keyboard semantics**

Add `role="button"`, `tabindex="0"`, `aria-expanded`/`aria-current`, and Enter/Space
handlers to category headers and feed items. Tokenize warning and unread states.
Do not convert drag/drop containers into nested buttons.

- [ ] **Step 6: Run focused tests and lint**

Run: `npm run test:unit -- src/components/sidebar` and
`npx eslint frontend/src/components/sidebar`

Expected: tests pass and ESLint exits 0.

### Task 4: Complete Semantic Theme Tokens and Reader-Shell Styling

**Files:**
- Modify: `frontend/src/style.css`
- Modify: `frontend/src/components/article/ArticleList.vue`
- Modify: `frontend/src/components/article/ArticleToolbar.vue`
- Modify: `frontend/src/components/sidebar/ActivityBar.vue`
- Modify: `frontend/src/components/sidebar/FeedList.vue`
- Modify: `frontend/src/components/sidebar/SidebarCategory.vue`
- Modify: `frontend/src/components/sidebar/SidebarFeed.vue`
- Modify: `frontend/src/components/sidebar/SavedFilterItem.vue`

**Interfaces:**
- Existing `theme.ts` preset names and persistence remain unchanged.
- New tokens are CSS custom properties consumed by shell components; no new
  settings schema keys are required.

- [ ] **Step 1: Add token contract tests**

Extend `frontend/src/utils/theme.test.ts` to assert each preset writes a
`data-theme-preset`, dark-mode state, and a non-empty computed value for
`--surface-rail`, `--surface-panel`, `--surface-selected`, and
`--text-tertiary` after the stylesheet is loaded in browser verification.

- [ ] **Step 2: Run the token tests and verify the new variables are absent**

Run: `npm run test:unit -- src/utils/theme.test.ts`

Expected: the new token assertions fail until CSS variables are added.

- [ ] **Step 3: Add complete preset token sets**

Define the shell surface, tertiary text, warning, danger, unread badge, backdrop,
and overlay-shadow tokens under `:root`, Ink, Sepia, and High Contrast. Preserve
the existing theme token names and values where they are already correct.

- [ ] **Step 4: Replace shell hard-coded colors**

Use tokens for rail/drawer selected and hover surfaces, unread badges, warning
icons, active filter background, favorite/read-later toolbar states, and the
resizer. Remove the old `.dark-mode` scrollbar overrides and use the semantic
scrollbar token across presets.

- [ ] **Step 5: Add reduced-motion and focus rules**

Ensure compact overlay, rail, and feed transitions stop moving under
`prefers-reduced-motion: reduce`; retain a 2px `:focus-visible` outline using the
current accent token.

- [ ] **Step 6: Run theme tests, lint, and formatting**

Run: `npm run test:unit -- src/utils/theme.test.ts`,
`npx eslint frontend/src/style.css frontend/src/components/article/ArticleList.vue frontend/src/components/article/ArticleToolbar.vue frontend/src/components/sidebar`, and
`npx prettier --check frontend/src/style.css frontend/src/components/article/ArticleList.vue frontend/src/components/article/ArticleToolbar.vue frontend/src/components/sidebar`

Expected: all commands exit 0.

### Task 5: Establish the Measured Reading Column

**Files:**
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Modify: `frontend/src/components/article/ArticleContent.css`
- Modify: `frontend/src/components/article/parts/ArticleTitle.vue`
- Modify: `frontend/src/components/article/parts/ArticleSummary.vue`

**Interfaces:**
- Existing article content props/events, translation behavior, summary behavior,
  scroll restoration, and reading-mode progress remain unchanged.

- [ ] **Step 1: Add a structural reading-column assertion**

Extend `ArticleContent.test.ts` to assert the reader has a dedicated
`data-testid="article-reading-column"` wrapper and that its class list includes a
measured-column class while the current focus/progress assertions continue to pass.

- [ ] **Step 2: Run the ArticleContent test and verify it fails**

Run: `npm run test:unit -- src/components/article/ArticleContent.test.ts`

Expected: FAIL because the wrapper/test id is not present.

- [ ] **Step 3: Add the measured column wrapper and styles**

Wrap title, media, summary, body, and full-text action in a semantic reading column
with `width: min(100%, 72ch)` and responsive horizontal padding. Keep media able to
escape the text measure only where it remains contained by the reader viewport.
Use `overflow-wrap:anywhere` for long links and preserve the user-selected content
font size and line height from `ArticleBody`.

- [ ] **Step 4: Tune title/summary spacing and metadata contrast**

Use stable product-scale type and tokenized tertiary metadata. Keep title wrapping
balanced without fluid viewport font sizing, and ensure summary controls retain
accessible labels and visible focus.

- [ ] **Step 5: Run ArticleContent tests and formatting**

Run: `npm run test:unit -- src/components/article/ArticleContent.test.ts` and
`npx prettier --check frontend/src/components/article/ArticleContent.vue frontend/src/components/article/ArticleContent.css frontend/src/components/article/parts/ArticleTitle.vue frontend/src/components/article/parts/ArticleSummary.vue`

Expected: all tests pass and formatting exits 0.

### Task 6: Full Verification and Browser Review

**Files:**
- No new source files; use the changed files from Tasks 1-5.

- [ ] **Step 1: Run the complete frontend unit suite**

Run: `npm run test:unit`

Expected: all existing and new tests pass with 0 failures.

- [ ] **Step 2: Run static checks**

Run: `npx eslint frontend/src` and `npx prettier --check frontend/src`

Expected: both commands exit 0.

- [ ] **Step 3: Build the frontend**

Run: `npm run build`

Expected: Vite exits 0; existing bundle-size warnings may remain but are recorded.

- [ ] **Step 4: Verify browser layouts and themes**

With the dev server running, inspect 1440x900, 1024x900, 768x900, and 390x844.
For each of Paper, Ink, Sepia, and High Contrast verify computed preset state,
shell contrast, selected navigation, focus ring, and no horizontal overlap. At
390px verify navigation starts closed, opens as an overlay, closes by backdrop and
Escape, and returns focus to the trigger. At desktop verify the pinned feed drawer
and three-pane layout remain available.

- [ ] **Step 5: Run scoped accessibility checks**

Run an accessibility scan on the navigation shell and theme picker. Record any
pre-existing violations separately from regressions introduced by this work.

- [ ] **Step 6: Review the diff and preserve unrelated changes**

Run `git diff --check` and `git status --short`; confirm no existing user changes
were reverted or staged accidentally. Only then report the implementation status.
