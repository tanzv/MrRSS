# Reader Navigation and Comprehension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make reading-mode navigation, translation, appearance feedback, and short-article read tracking clearer without widening or distracting from the article column.

**Architecture:** `ArticleToolbar` exposes named reader intents and owns the bounded More menu; `ArticleDetail`/`ArticleDetailModal` keep session-only view state and pass it to `ArticleContent`. `FloatingToc` renders the same heading data as an expanded desktop rail or a mobile bottom sheet. Reader save feedback remains in `useReaderTypographyPreferences`, while scrollability and short-content dwell stay in `ArticleContent` and are routed through the existing read-tracking composable.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Tailwind CSS, Vitest + Vue Test Utils, Playwright, Vite, Wails v3.

## Global Constraints

- Reuse Phosphor icons, existing semantic CSS variables, `ui-button`, `ui-icon-button`, and `app-panel-header`.
- Keep all new user-facing text in `frontend/src/i18n/locales/en.ts` and `frontend/src/i18n/locales/zh.ts`.
- Keep the reader article column at existing 58/72/88ch desktop values and full width on mobile.
- Touch controls at widths below 768px must remain at least 44px tall/wide.
- Do not persist reader translation mode or add dependencies, settings schema fields, or database migrations.
- Each behavior change has a matching test; use deterministic fake timers for dwell and autosave tests.

---

### Task 1: Add reader toolbar intentions and session-only translation mode

**Files:**
- Modify: `frontend/src/components/article/ArticleToolbar.vue`
- Modify: `frontend/src/components/article/ArticleDetail.vue`
- Modify: `frontend/src/components/article/ArticleDetailModal.vue`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Test: `frontend/src/components/article/ArticleToolbar.test.ts`
- Test: `frontend/src/components/article/ArticleDetail.test.ts`
- Test: `frontend/src/components/article/ArticleDetailModal.test.ts`

**Interfaces:**
- Produces from toolbar: `open-find`, `toggle-contents`, and `set-translation-display-mode` events.
- Consumes in details: `TranslationDisplayMode = 'original' | 'bilingual' | 'translation'` and `show-contents` state passed to `ArticleContent`.
- Produces to content: `translation-display-mode?: TranslationDisplayMode`, `show-contents?: boolean`, `@close-contents`.

- [ ] **Step 1: Write failing toolbar tests for the primary reading actions and More menu**

```ts
it('keeps exit, find, contents, appearance, and more as named reader actions', async () => {
  const wrapper = mountToolbar({ showContent: true, isReadingMode: true, hasReaderContent: true })
  await wrapper.get('[data-testid="reader-more-trigger"]').trigger('click')

  expect(wrapper.get('[data-testid="reader-exit"]').text()).toContain('Exit reading mode')
  expect(wrapper.get('[data-testid="reader-find"]').attributes('aria-label')).toBe('Find in article')
  expect(wrapper.get('[data-testid="reader-contents"]').attributes('aria-expanded')).toBe('false')
  expect(wrapper.get('[role="menu"]').text()).toContain('Bilingual')
})
```

- [ ] **Step 2: Run focused toolbar test and verify the feature-specific assertion fails**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleToolbar.test.ts`

Expected: FAIL because `reader-more-trigger` and named reader action controls do not exist.

- [ ] **Step 3: Write failing detail tests for the propagated reader intents**

```ts
it('opens find and passes translation-only session mode to the rendered reader', async () => {
  const wrapper = mountDetailWithReaderContent()
  await wrapper.get('[data-testid="reader-find"]').trigger('click')
  await wrapper.getComponent(ArticleToolbar).vm.$emit('setTranslationDisplayMode', 'translation')

  expect(wrapper.findComponent(FindInPage).exists()).toBe(true)
  expect(wrapper.findComponent(ArticleContent).props('translationDisplayMode')).toBe('translation')
})
```

- [ ] **Step 4: Run focused detail tests and verify the new prop/event contract fails**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleDetail.test.ts src/components/article/ArticleDetailModal.test.ts`

Expected: FAIL because the emitted event and `translationDisplayMode` prop are absent.

- [ ] **Step 5: Implement the smallest toolbar/menu and detail state changes that satisfy the contracts**

```ts
type TranslationDisplayMode = 'original' | 'bilingual' | 'translation'

const translationDisplayMode = ref<TranslationDisplayMode>('bilingual')
const showReaderContents = ref(false)

function setTranslationDisplayMode(mode: TranslationDisplayMode): void {
  translationDisplayMode.value = mode
}
```

Use actual `<button role="menuitem">` actions, close the menu after action/Escape/outside click, restore trigger focus on Escape, and use existing Phosphor imports (`PhArrowLeft`, `PhMagnifyingGlass`, `PhListBullets`, `PhDotsThree`). Map `original` to hidden translations, `bilingual` to visible translations, and `translation` to translation-only rendering without touching global settings.

- [ ] **Step 6: Add complete English and Simplified Chinese labels and run the three focused test files**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleToolbar.test.ts src/components/article/ArticleDetail.test.ts src/components/article/ArticleDetailModal.test.ts`

Expected: PASS with all prior tests plus new visible action/session-mode assertions.

### Task 2: Make the table of contents usable on desktop and mobile

**Files:**
- Modify: `frontend/src/components/article/parts/FloatingToc.vue`
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Test: `frontend/src/components/article/ArticleContent.test.ts`
- Test: `frontend/src/components/article/parts/FloatingToc.test.ts` (create)

**Interfaces:**
- `FloatingToc` consumes `expanded?: boolean`, emits `close` and `select`.
- `ArticleContent` consumes `showContents?: boolean`, emits `closeContents`.
- The desktop rail exposes all labels when `expanded`; mobile renders `role="dialog"` from the same `tocItems` source.

- [ ] **Step 1: Write a failing mobile TOC test that builds headings and opens a dialog**

```ts
it('opens the same heading list in a mobile contents sheet and closes after selection', async () => {
  const wrapper = mountFloatingToc({ mobile: true, expanded: true, headings: ['First', 'Second'] })

  expect(document.body.querySelector('[data-testid="reader-contents-sheet"]')).not.toBeNull()
  await document.body.querySelector<HTMLButtonElement>('[data-testid="toc-item-0"]')?.click()

  expect(wrapper.emitted('select')).toEqual([[expect.objectContaining({ text: 'First' })]])
  expect(wrapper.emitted('close')).toEqual([[]])
})
```

- [ ] **Step 2: Run the new focused TOC test and verify it fails because mobile items are discarded**

Run: `cd frontend && npm run test:unit -- src/components/article/parts/FloatingToc.test.ts`

Expected: FAIL because `buildToc` clears `tocItems` when `isDesktop` is false.

- [ ] **Step 3: Write a failing content wiring test for the toolbar-driven contents state**

```ts
it('forwards a contents request to FloatingToc and clears it when the TOC closes', async () => {
  const reader = mountReader('<h2>Section</h2><p>Body</p>', { showContents: true })
  const toc = reader.findComponent(FloatingToc)

  expect(toc.props('expanded')).toBe(true)
  toc.vm.$emit('close')
  expect(reader.emitted('closeContents')).toEqual([[]])
})
```

- [ ] **Step 4: Run the focused ArticleContent test and verify the new props do not exist**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleContent.test.ts`

Expected: FAIL because `showContents` is not passed to `FloatingToc` and it cannot emit `closeContents`.

- [ ] **Step 5: Implement shared TOC data with responsive presentation**

```ts
interface Props {
  articleId: number
  enabled: boolean
  scrollContainer: HTMLElement | null
  expanded?: boolean
}

function selectHeading(item: TocItem): void {
  scrollToHeading(item)
  emit('select', item)
  emit('close')
}
```

Build headings whenever `enabled` and a scroll container exist. Preserve desktop rail behavior, but make labels visible while `expanded`; render an accessible mobile bottom sheet with focus trap, Escape/outside close, touch-safe row heights, no-heading empty state, safe-area padding, and reduced-motion-aware scroll behavior.

- [ ] **Step 6: Run focused TOC/content tests**

Run: `cd frontend && npm run test:unit -- src/components/article/parts/FloatingToc.test.ts src/components/article/ArticleContent.test.ts`

Expected: PASS, including desktop label expansion, mobile dialog selection, and content wiring.

### Task 3: Add progressive disclosure and saved feedback to reader appearance

**Files:**
- Modify: `frontend/src/composables/article/useReaderTypographyPreferences.ts`
- Modify: `frontend/src/components/article/ReaderAppearancePanel.vue`
- Modify: `frontend/src/components/article/ArticleToolbar.vue`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Test: `frontend/src/composables/article/useReaderTypographyPreferences.test.ts`
- Test: `frontend/src/components/article/ReaderAppearancePanel.test.ts`
- Test: `frontend/src/components/article/ArticleToolbar.test.ts`

**Interfaces:**
- `ReaderTypographyPreferences` produces `saveState: Readonly<Ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>>`.
- `ReaderAppearancePanel` consumes `saveState?: ReaderAppearanceSaveState` and exposes live status with `data-testid="reader-appearance-save-status"`.
- `ArticleToolbar` forwards save state from its always-mounted preferences composable.

- [ ] **Step 1: Write a failing preferences test for pending, saving, and saved state**

```ts
it('exposes pending, saving, and saved states around a debounced appearance save', async () => {
  vi.useFakeTimers()
  let resolveRequest!: (response: Response) => void
  const { preferences } = mountPreferences({ request: () => new Promise(resolve => { resolveRequest = resolve }) })

  preferences.updateTypography({ content_font_size: 18 })
  expect(preferences.saveState.value).toBe('pending')
  await vi.advanceTimersByTimeAsync(500)
  expect(preferences.saveState.value).toBe('saving')
  resolveRequest({ ok: true } as Response)
  await flushPromises()
  expect(preferences.saveState.value).toBe('saved')
})
```

- [ ] **Step 2: Run the focused composable test and verify `saveState` is missing**

Run: `cd frontend && npm run test:unit -- src/composables/article/useReaderTypographyPreferences.test.ts`

Expected: FAIL because preferences currently expose only `isSaving` and `saveError`.

- [ ] **Step 3: Write failing panel tests for collapsed advanced controls and live save feedback**

```ts
it('keeps quick controls visible while advanced canvas controls are collapsed and announces save state', () => {
  mountPanel({ mobile: false, saveState: 'saved' })
  const panel = getPanelElement()

  expect(panel.querySelector('[data-testid="reader-font-size-control"]')).not.toBeNull()
  expect(panel.querySelector('[data-testid="reader-appearance-advanced"]')?.hasAttribute('open')).toBe(false)
  expect(panel.querySelector('[data-testid="reader-appearance-save-status"]')?.textContent).toContain('Saved')
})
```

- [ ] **Step 4: Run focused panel/toolbar tests and verify the assertion fails**

Run: `cd frontend && npm run test:unit -- src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.test.ts`

Expected: FAIL because advanced controls are always visible and no success status is rendered.

- [ ] **Step 5: Implement the save state machine and panel grouping**

```ts
export type ReaderAppearanceSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

function scheduleSave(): void {
  saveState.value = 'pending'
  clearSaveTimer()
  saveTimer = setTimeout(() => void flushSave(), debounceMs)
}
```

Set `saving` immediately before the request, `saved` after a complete successful flush, and `error` on failure. Keep `isSaving`/`saveError` for existing consumers while forwarding the new state. In the panel, place width, canvas colors, and preview inside a semantic `<details data-testid="reader-appearance-advanced">`; retain quick controls outside, preserve current mobile width behavior, and present localized status via `aria-live="polite"`.

- [ ] **Step 6: Run focused autosave and panel tests**

Run: `cd frontend && npm run test:unit -- src/composables/article/useReaderTypographyPreferences.test.ts src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.test.ts`

Expected: PASS with deterministic pending/saving/saved/error behavior and no mobile regression.

### Task 4: Fix short-article progress reporting and delayed scroll-marking

**Files:**
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Modify: `frontend/src/components/article/ArticleDetail.vue`
- Modify: `frontend/src/components/article/ArticleDetailModal.vue`
- Modify: `frontend/src/components/article/ArticleToolbar.vue`
- Test: `frontend/src/components/article/ArticleContent.test.ts`
- Test: `frontend/src/components/article/ArticleDetail.test.ts`
- Test: `frontend/src/components/article/ArticleDetailModal.test.ts`

**Interfaces:**
- `ArticleContent` emits `scrollability: [isScrollable: boolean]` and `shortArticleDwell: []` in addition to existing `readingProgress: [percent: number]`.
- Details pass `readingProgress: number | null` to toolbar and forward `shortArticleDwell` to `handleReadingProgress(100)` only through the existing read-tracking policy.
- Toolbar hides numeric/progress-bar UI when `readingProgress === null`.

- [ ] **Step 1: Write a failing ArticleContent regression test for a non-scrollable reader**

```ts
it('does not report a completed scroll progress for a fully visible short article', async () => {
  vi.useFakeTimers()
  const reader = mountReader('<p>Short</p>', { isReadingMode: true })
  setScrollMetrics(reader, { clientHeight: 200, scrollHeight: 200, scrollTop: 0 })

  await nextTick()
  expect(reader.emitted('scrollability')?.at(-1)).toEqual([false])
  expect(reader.emitted('readingProgress')?.some(([percent]) => percent === 100)).toBe(false)
})
```

- [ ] **Step 2: Run the focused reader test and verify it fails at the current 100% result**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleContent.test.ts`

Expected: FAIL because `getReadingProgress()` returns 100 for `scrollHeight === clientHeight`.

- [ ] **Step 3: Write a failing dwell lifecycle test and detail forwarding test**

```ts
it('emits one dwell event after four visible seconds and cancels it when reading mode exits', async () => {
  vi.useFakeTimers()
  const reader = mountReader('<p>Short</p>', { isReadingMode: true })
  setScrollMetrics(reader, { clientHeight: 200, scrollHeight: 200, scrollTop: 0 })
  await vi.advanceTimersByTimeAsync(4000)
  expect(reader.emitted('shortArticleDwell')).toEqual([[]])

  await reader.setProps({ isReadingMode: false })
  await vi.advanceTimersByTimeAsync(4000)
  expect(reader.emitted('shortArticleDwell')).toEqual([[]])
})
```

- [ ] **Step 4: Run focused content/detail/modal tests and verify events are absent**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleContent.test.ts src/components/article/ArticleDetail.test.ts src/components/article/ArticleDetailModal.test.ts`

Expected: FAIL because `scrollability` and `shortArticleDwell` are not emitted or handled.

- [ ] **Step 5: Implement real scrollability detection and a cancelable dwell timer**

```ts
const SHORT_ARTICLE_DWELL_MS = 4000

function getScrollability(): boolean {
  const container = articleScrollContainer.value
  return Boolean(container && container.scrollHeight > container.clientHeight)
}

function scheduleShortArticleDwell(): void {
  clearShortArticleDwell()
  if (!props.isReadingMode || getScrollability() || document.visibilityState === 'hidden') return
  shortArticleDwellTimer = setTimeout(() => emit('shortArticleDwell'), SHORT_ARTICLE_DWELL_MS)
}
```

Emit scrollability whenever content/reader layout becomes ready, report ordinary percentages only for scrollable content, cancel/refresh timer on article ID, reading mode, content, visibility, and unmount changes. Use existing `handleReadingProgress(article, 100)` in both details so settings and request de-duplication remain centralized. Change the progress fill to transform-based rendering with a reduced-motion fallback.

- [ ] **Step 6: Run focused regression tests**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleContent.test.ts src/components/article/ArticleDetail.test.ts src/components/article/ArticleDetailModal.test.ts src/composables/article/useArticleReadTracking.test.ts`

Expected: PASS, with the 50% policy still covered and short content delayed rather than immediately marked.

### Task 5: Integrate, inspect, and verify the reader at real viewports

**Files:**
- Modify only as required by evidence from the checks below.
- Test: `frontend/src/components/article/ArticleToolbar.test.ts`
- Test: `frontend/src/components/article/ArticleContent.test.ts`
- Test: `frontend/src/components/article/parts/FloatingToc.test.ts`

**Interfaces:**
- No new public interfaces. This task verifies the contracts from Tasks 1–4 together.

- [ ] **Step 1: Run the focused frontend unit suite**

Run: `cd frontend && npm run test:unit -- src/components/article/ArticleToolbar.test.ts src/components/article/ArticleDetail.test.ts src/components/article/ArticleDetailModal.test.ts src/components/article/ArticleContent.test.ts src/components/article/parts/FloatingToc.test.ts src/components/article/ReaderAppearancePanel.test.ts src/composables/article/useReaderTypographyPreferences.test.ts src/composables/article/useArticleReadTracking.test.ts`

Expected: PASS with no failed tests, unhandled rejections, or Vue warnings.

- [ ] **Step 2: Use Playwright against the local Vite app at 1440px, 768px, and 390px**

```python
page.set_viewport_size({"width": 390, "height": 844})
page.get_by_test_id("reader-contents").click()
expect(page.get_by_test_id("reader-contents-sheet")).to_be_visible()
expect(page.locator("body").evaluate("el => el.scrollWidth <= el.clientWidth")).to_be(True)
```

Validate named toolbar controls, More keyboard dismissal, mobile TOC row activation, appearance saved feedback, progress hidden for a short article, desktop expanded TOC labels, no console errors, and both light/dark themes.

- [ ] **Step 3: Run full automated verification**

Run: `cd frontend && npm run test:unit && npm run build && cd .. && go test -v -timeout=5m ./... && wails3 build && git diff --check`

Expected: every command exits 0 and `git diff --check` produces no whitespace errors.

- [ ] **Step 4: Review changed files and summarize exact evidence before any commit or completion claim**

Run: `git status --short && git diff --stat && git diff --check`

Expected: only reader-mode implementation, locale, test, and approved planning/spec files are changed; no unrelated user work is altered.
