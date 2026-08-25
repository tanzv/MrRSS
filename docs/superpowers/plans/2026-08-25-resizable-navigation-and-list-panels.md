# Resizable Navigation and List Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `test-driven-development` for every behavior below. Keep the test red before adding the matching production code, then run the focused suite again before proceeding.

**Goal:** Let desktop users resize the fixed subscription-source drawer and article list without changing the activity rail, temporary drawer behavior, mobile layouts, or reading mode.

**Architecture:** `useResizablePanels` owns validated, persisted preferred widths and exposes only effective values plus mode-aware bounds. A reusable `PanelResizeHandle` owns pointer capture, keyboard interaction, reset, and ARIA semantics; `App.vue` connects it to the article-list boundary and passes subscription-drawer state through `Sidebar`. `Sidebar` only renders its handle for a desktop pinned drawer, while `FeedList` consumes the inherited CSS width variable instead of hard-coded breakpoints.

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS, semantic CSS variables, Vue Test Utils, Vitest, localStorage.

## Constraints

- Desktop behavior begins at `768px`; mobile keeps its existing `44px` activity rail and drawer width cap.
- The activity rail remains `48px` wide on desktop and `16px` in its auto-hide edge preview. Its auto-hide/reveal state must never change a saved drawer width.
- Only a pinned subscription drawer is resizable. Temporary drawer expansion, card layout, gallery layout, and reading mode must not expose an inappropriate handle.
- Store only user adjustments and resets in localStorage. Do not add settings-schema fields, backend APIs, database migrations, or dependencies.
- Reuse existing `--border-color` and `--accent-color` theme variables. The handle must be visually quiet until hover, focus, or drag.
- Preserve a wider saved preference across a narrow layout mode or viewport; clamp only the rendered effective width until enough room is available.
- Add all new user-facing accessibility labels to both English and Simplified Chinese locale files.
- Stage and commit only the files introduced for this feature. Do not absorb the existing reader-navigation worktree changes.

---

### Task 1: Replace ad-hoc panel state with validated persisted preferences

**Files:**
- Modify: `frontend/src/composables/ui/useResizablePanels.ts`
- Create: `frontend/src/composables/ui/useResizablePanels.test.ts`

**Interfaces:**
- Export `SIDEBAR_DRAWER_MIN_WIDTH`, `SIDEBAR_DRAWER_MAX_WIDTH`, `SIDEBAR_DRAWER_DEFAULT_WIDTH`.
- Export `getArticleListBounds(compact: boolean)` and `getArticleListDefaultWidth(compact: boolean)` for all consumers to share the same contract.
- `useResizablePanels()` returns `sidebarWidth`, `articleListWidth`, `setSidebarWidth`, `resetSidebarWidth`, `setArticleListWidth`, `resetArticleListWidth`, and `setCompactMode`.
- Store user preferences under `mrrss.sidebar-drawer-width` and `mrrss.article-list-width`.

- [x] **Step 1: Write failing composable tests for default widths and invalid stored values.**

```ts
it('falls back to the normal defaults when stored panel widths are invalid', () => {
  localStorage.setItem('mrrss.sidebar-drawer-width', 'not-a-number')
  localStorage.setItem('mrrss.article-list-width', '9000')

  const panels = useResizablePanels()

  expect(panels.sidebarWidth.value).toBe(280)
  expect(panels.articleListWidth.value).toBe(350)
})
```

- [x] **Step 2: Run the focused test and verify RED.**

Run: `cd frontend && npm run test:unit -- src/composables/ui/useResizablePanels.test.ts`

Expected: FAIL because the current composable neither reads nor validates localStorage values.

- [x] **Step 3: Write failing tests for user persistence, reset, and cross-layout clamping.**

```ts
it('keeps a compact preference while rendering a clamped normal-width value', () => {
  const panels = useResizablePanels()
  panels.setCompactMode(true)
  panels.setArticleListWidth(720)
  panels.setCompactMode(false)

  expect(panels.articleListWidth.value).toBe(600)
  panels.setCompactMode(true)
  expect(panels.articleListWidth.value).toBe(720)
})
```

Cover 240-420 drawer clamping, 280-600 normal list clamping, 300-800 compact list clamping, mode defaults (`350` / `500`) when no preference exists, writes after explicit updates, and double-click reset targets.

- [x] **Step 4: Run the focused test and verify RED.**

Run: `cd frontend && npm run test:unit -- src/composables/ui/useResizablePanels.test.ts`

Expected: FAIL because current resize state is transient and layout changes overwrite the article width.

- [x] **Step 5: Implement the smallest preference model that passes both tests.**

Use a safe number parser, a pure `clamp` helper, a stored raw preference for each surface, and computed effective values. `setCompactMode` changes the default only when the user has not stored an article-list preference; it must not write to storage. Remove the global mouse listeners and unused resize flags, because the new handle component owns pointer lifecycle.

- [x] **Step 6: Run the focused composable suite and commit the state layer.**

Run: `cd frontend && npm run test:unit -- src/composables/ui/useResizablePanels.test.ts`

Expected: PASS.

Commit: `feat(layout): persist resizable panel widths`

---

### Task 2: Create an accessible shared resize handle

**Files:**
- Create: `frontend/src/components/common/PanelResizeHandle.vue`
- Create: `frontend/src/components/common/PanelResizeHandle.test.ts`

**Interfaces:**
- Props: `modelValue`, `min`, `max`, `defaultValue`, `label`.
- Emits: `update:modelValue` for a clamped user value and `reset` after a double-click reset.
- DOM contract: focusable `role="separator"`, `aria-orientation="vertical"`, and synchronized `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.

- [x] **Step 1: Write a failing semantic and keyboard interaction test.**

```ts
it('exposes a vertical separator and changes width with keyboard controls', async () => {
  const wrapper = mountHandle({ modelValue: 280, min: 240, max: 420 })
  const handle = wrapper.get('[role="separator"]')

  expect(handle.attributes('aria-valuenow')).toBe('280')
  await handle.trigger('keydown', { key: 'ArrowRight' })
  await handle.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
  await handle.trigger('keydown', { key: 'Home' })

  expect(wrapper.emitted('update:modelValue')).toEqual([[296], [328], [240]])
})
```

- [x] **Step 2: Run the focused handle test and verify RED.**

Run: `cd frontend && npm run test:unit -- src/components/common/PanelResizeHandle.test.ts`

Expected: FAIL because the reusable separator does not exist.

- [x] **Step 3: Write failing pointer and reset lifecycle tests.**

Test `pointerdown` captures the pointer, horizontal drag derives a clamped width from the start point, `pointercancel` restores `document.body` cursor/selection state, unmount performs the same cleanup, and `dblclick` emits the current surface default.

- [x] **Step 4: Run the focused handle test and verify RED.**

Run: `cd frontend && npm run test:unit -- src/components/common/PanelResizeHandle.test.ts`

Expected: FAIL because no pointer capture, body-state cleanup, or reset behavior exists.

- [x] **Step 5: Implement the self-contained separator.**

Use Pointer Events and `setPointerCapture`; accept only the primary pointer. Apply a 16px keyboard step, 48px with Shift, and min/max values for Home/End. Use `onBeforeUnmount` to clear the drag state. Style a 6px hit region with a 1px visual indicator that becomes visible with `--accent-color` only on `:hover`, `:focus-visible`, or `.is-resizing`; do not add width transitions or shadow.

- [x] **Step 6: Run the focused handle suite and commit the primitive.**

Run: `cd frontend && npm run test:unit -- src/components/common/PanelResizeHandle.test.ts`

Expected: PASS.

Commit: `feat(ui): add accessible panel resize handle`

---

### Task 3: Connect the article-list boundary without overriding saved preferences

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/components/article/ArticleList.vue`
- Modify: `frontend/src/App.test.ts` or create `frontend/src/components/article/ArticleListResize.test.ts` if the app harness cannot isolate the visibility contract
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- `App.vue` consumes `PanelResizeHandle` and the new `useResizablePanels` API; it no longer registers raw `mousedown` resizing.
- The article handle has `data-testid="article-list-resize-handle"` and uses the mode-aware bounds/defaults from the composable.
- `ArticleList` derives its desktop width from `--article-list-width` without the existing `max-width: 1400px` hard cap.

- [x] **Step 1: Write a failing render-contract test for the article resize handle.**

```ts
it('renders the article resize handle only outside card and reading modes', () => {
  expect(appSource).toContain('data-testid="article-list-resize-handle"')
  expect(appSource).toMatch(/v-show="!store\.isReadingMode"/)
  expect(appSource).toMatch(/v-if="!isCardMode"/)
})
```

When practical in the existing harness, mount the relevant region and assert that changing the separator emits updates to the composable-backed CSS variable.

- [x] **Step 2: Run the focused test and verify RED.**

Run: `cd frontend && npm run test:unit -- src/App.test.ts`

Expected: FAIL because the app currently uses a bare `.resizer` div and legacy mouse handler.

- [x] **Step 3: Implement article-list integration.**

Replace the bare divider with `PanelResizeHandle`, use localized label text, and connect update/reset events to the composable. Remove the settings-load and layout-change calls that forcibly set article width; `setCompactMode` becomes the single layout-mode update. Keep the handle hidden below `md`, in card mode, and while reading. Remove the legacy `.resizer` CSS.

In `ArticleList.vue`, remove the `min(..., 320px)` medium-desktop override so a chosen width remains effective; retain a viewport-safe cap through layout constraints rather than overwriting the preference.

- [x] **Step 4: Run focused article/application tests and commit.**

Run: `cd frontend && npm run test:unit -- src/App.test.ts src/components/article/ArticleList.test.ts src/composables/ui/useResizablePanels.test.ts`

Expected: PASS.

Commit: `feat(reader): make article list width adjustable`

---

### Task 4: Connect pinned subscription drawer width while preserving auto-hide behavior

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/components/sidebar/Sidebar.vue`
- Modify: `frontend/src/components/sidebar/FeedList.vue`
- Modify: `frontend/src/components/sidebar/SidebarNavigation.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- `App.vue` passes `drawer-width` to `Sidebar` and receives `update:drawer-width` / `reset-drawer-width`.
- `Sidebar` accepts `drawerWidth`, emits the matching events, and adds `data-testid="feed-drawer-resize-handle"` only for `isFeedListPinned && !isMobile`.
- `FeedList` inherits `--sidebar-drawer-width` from its wrapper; it removes fixed Tailwind width classes and the 1400px-to-240px media override.

- [x] **Step 1: Write a failing sidebar test for the fixed-drawer-only rule.**

```ts
it('exposes a resize handle only for a pinned desktop feed drawer', async () => {
  const wrapper = mountSidebar({ isMobile: false })
  await setFeedDrawerState(wrapper, { expanded: true, pinned: true })
  expect(wrapper.find('[data-testid="feed-drawer-resize-handle"]').exists()).toBe(true)

  await setFeedDrawerState(wrapper, { expanded: true, pinned: false })
  expect(wrapper.find('[data-testid="feed-drawer-resize-handle"]').exists()).toBe(false)
})
```

Also assert a mobile pinned drawer never renders the handle and that emitted update/reset events pass through unchanged.

- [x] **Step 2: Run the focused sidebar test and verify RED.**

Run: `cd frontend && npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts`

Expected: FAIL because no resize-handle branch or width events are present.

- [x] **Step 3: Implement fixed drawer integration and quiet styling.**

Pass the width as an inherited CSS custom property on `.feed-drawer-wrapper`. Render the shared handle at its right edge only while pinned and desktop. Keep it inside the wrapper so it tracks compact-shell and auto-hide offsets without changing those existing position rules. Ensure the wrapper itself reserves the drawer width so the handle stays aligned.

Update `FeedList` to use `width`/`min-width: var(--sidebar-drawer-width, 280px)` on desktop, capped by available viewport space; retain the mobile override unchanged. Delete only the stale hard-coded width classes and <=1400px forced width block.

- [x] **Step 4: Add localized labels and run focused sidebar tests.**

Run: `cd frontend && npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts src/components/sidebar/FeedList.test.ts`

Expected: PASS, including existing auto-hide and edge-preview tests.

- [x] **Step 5: Commit the subscription-drawer integration.**

Commit: `feat(sidebar): resize pinned subscription drawer`

---

### Task 5: Verify the integrated desktop and responsive behavior

**Files:**
- Modify only if verification exposes an implementation defect; otherwise no production files.
- Optionally add focused regression assertions to the test files above before fixing a defect.

- [x] **Step 1: Run the complete affected frontend suite.**

Run: `cd frontend && npm run test:unit -- src/composables/ui/useResizablePanels.test.ts src/components/common/PanelResizeHandle.test.ts src/App.test.ts src/components/article/ArticleList.test.ts src/components/sidebar/SidebarNavigation.test.ts src/components/sidebar/FeedList.test.ts`

Expected: PASS with no test warnings.

- [x] **Step 2: Run frontend type checking and production build.**

Run: `cd frontend && npm run type-check && npm run build`

Expected: PASS. If the project does not expose `type-check`, run its documented equivalent and report it.

- [x] **Step 3: Inspect the app at desktop, narrow-desktop, and mobile widths.**

At least inspect `1440px`, `1024px`, and `390px` viewports. Verify both desktop handles have a restrained idle state, clear focus state, no overflow during min/max drag, resets work, and saved values survive reload. Confirm the subscription handle is absent in temporary drawer and mobile states, the article handle is absent in card/reading modes, and all four built-in themes preserve contrast.

- [x] **Step 4: Review staged patches and commit only verified feature files.**

Run: `git diff --check`, inspect `git diff --cached`, and make no changes to unrelated reader-navigation files. Keep the Task 1-4 commits separate; add a follow-up `test(...)` or `fix(...)` commit only when verification requires a narrowly scoped regression correction.

---

## Final Verification Record

- [x] Tests observed red before matching implementation.
- [x] Focused behavior suites pass.
- [x] ESLint and frontend production build pass; this project has no `type-check` script.
- [x] Browser and responsive component verification passes.
- [x] `git diff --check` passes.
- [x] Feature commits remain split by responsibility, with a final regression-fix commit; unrelated worktree changes remain unstaged.

Completed verification:

- `npm run test:unit`: 55 test files and 340 tests passed.
- Targeted Prettier and ESLint checks passed for the changed panel files.
- `npm run build` and `wails3 build` passed.
- Browser verification covered pinned-drawer leave timing, reader-width preservation, and disabled handles in gallery and card layouts.
