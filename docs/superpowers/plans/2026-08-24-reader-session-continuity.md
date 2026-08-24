# Reader Session Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let desktop readers temporarily reveal the article list from the left edge and return safely from an in-app link page to the same reader session.

**Architecture:** Reuse the existing transient edge-reveal state machine in `App.vue` to turn the already-mounted article list into a desktop-only overlay. Replace native rendered-link navigation with an `open-link` event from `ArticleContent`; `ArticleDetail` owns a transient, proxied iframe layer and its explicit return action, leaving the rendered article mounted below it.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Pinia, vue-i18n, Tailwind CSS, Vitest, Vue Test Utils, Wails v3.

## Global Constraints

- Do not reveal the feed sidebar from the reader edge.
- Do not add browser-history stacks, settings-schema fields, database migrations, dependencies, or backend endpoints.
- Reuse `/api/webpage/proxy` and the existing iframe sandbox policy.
- Preserve the explicit “Open in Browser” command and all image-link, page-fragment, and unsupported-protocol behavior.
- Keep the article list mounted; its filters and scroll position must survive entering, revealing, and leaving reader mode.
- Use tests first and observe each new regression test fail before changing production code.
- Preserve unrelated dirty worktree changes. Do not stage or commit implementation files.

---

## File Structure

- `frontend/src/App.vue`: Owns the desktop reader edge region and repositions the existing article-list wrapper as a transient overlay.
- `frontend/src/App.test.ts`: Covers reading-mode edge reveal, retraction, article-selection dismissal, and sidebar concealment.
- `frontend/src/components/article/ArticleContent.vue`: Resolves safe text-link URLs and emits an in-app navigation request instead of allowing document navigation.
- `frontend/src/components/article/ArticleContent.test.ts`: Covers resolved link emission, prevented native navigation, summary links, and exclusions.
- `frontend/src/components/article/ArticleDetail.vue`: Owns the transient reader-link iframe layer, return action, and Escape handling.
- `frontend/src/components/article/ArticleDetail.test.ts`: Covers opening and closing the layer without ending the reader session.
- `frontend/src/i18n/locales/en.ts` and `frontend/src/i18n/locales/zh.ts`: Localize the edge trigger and in-reader return controls.

## Task 1: Reveal the Existing Article List From the Reader Edge

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- Consumes: `useSidebarEdgeReveal({ isAutoHideEnabled, isMobile })` with a computed enabled flag for desktop, non-card reader mode.
- Produces: `isReaderArticleListRevealed`, a session-only boolean that controls only the article-list wrapper's overlay state.
- Keeps: `Sidebar` hidden while `store.isReadingMode` is true.

- [x] **Step 1: Write failing App behavior tests**

```ts
it('reveals only the article list when the desktop reader edge is entered', async () => {
  vi.useFakeTimers();
  const { wrapper, store } = mountDesktopApp();

  store.setReadingMode(true);
  await nextTick();

  const edge = wrapper.get('[data-testid="reader-article-list-edge"]');
  edge.element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await nextTick();

  expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).toContain(
    'is-revealed'
  );
  expect(wrapper.get('[data-testid="reading-sidebar-container"]').classes()).toContain('md:hidden');

  wrapper.get('[data-testid="reading-article-list-container"]').element.dispatchEvent(
    new PointerEvent('pointerleave', { pointerType: 'mouse' })
  );
  vi.advanceTimersByTime(180);
  await nextTick();

  expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).not.toContain(
    'is-revealed'
  );
  vi.useRealTimers();
});

it('retracts the temporary reader list after selecting another article', async () => {
  const { wrapper, store } = mountDesktopApp();
  store.setReadingMode(true);
  await nextTick();

  wrapper.get('[data-testid="reader-article-list-edge"]').element.dispatchEvent(
    new PointerEvent('pointerenter', { pointerType: 'mouse' })
  );
  await nextTick();
  store.currentArticleId = 42;
  await nextTick();

  expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).not.toContain(
    'is-revealed'
  );
});
```

`mountDesktopApp()` must use the existing App stubs and a `matchMedia` mock in
which both shell queries are false. Its `ArticleList` stub must remain mounted
so the assertion detects a CSS/state change rather than a second list instance.

- [x] **Step 2: Run the focused App test and verify it fails**

Run: `cd frontend && npm test -- --run src/App.test.ts`

Expected: FAIL because `reader-article-list-edge` and the `is-revealed` state
do not exist.

- [x] **Step 3: Implement the smallest reader-only edge overlay**

```ts
const isReaderArticleListRevealEnabled = computed(
  () => store.isReadingMode && !isMobileViewport.value && !isCardMode.value
);
const {
  isTemporarilyRevealed: isReaderArticleListRevealed,
  handlePointerEnter: handleReaderArticleListPointerEnter,
  handlePointerLeave: handleReaderArticleListPointerLeave,
  handleFocusIn: handleReaderArticleListFocusIn,
  handleFocusOut: handleReaderArticleListFocusOut,
  dismissTemporaryReveal: dismissReaderArticleListReveal,
} = useSidebarEdgeReveal({
  isAutoHideEnabled: isReaderArticleListRevealEnabled,
  isMobile: isMobileViewport,
});

watch(
  () => store.currentArticleId,
  (articleId, previousArticleId) => {
    if (store.isReadingMode && articleId !== previousArticleId) {
      dismissReaderArticleListReveal();
    }
  }
);
```

Render the existing `ArticleList` exactly once. Outside the enabled reader
state, retain the `contents` wrapper and existing `md:hidden` behavior. Inside
the enabled reader state, turn that same wrapper into a fixed 16px left-edge
region with `data-testid="reader-article-list-edge"`; attach its pointer and
focus handlers to the wrapper, include a labeled focusable button, and give it
the `is-revealed` class while transient state is true.

Use scoped CSS so the wrapper is fixed, full-height, and `z-40`; hide only its
child `.article-list` while collapsed, then show it at
`min(var(--article-list-width), calc(100vw - 3rem))` while revealed. Do not
move the sidebar or change reader width. Use `var(--overlay-shadow)` for
overlay elevation and disable the width transition under
`prefers-reduced-motion: reduce`.

Add `article.readingMode.showArticleList` as **Show article list** / **显示文章列表**.

- [x] **Step 4: Run the App test and verify it passes**

Run: `cd frontend && npm test -- --run src/App.test.ts`

Expected: PASS. The original “not unmounted” assertions continue to pass.

- [x] **Step 5: Run the focused lint checkpoint**

Run: `cd frontend && npx eslint src/App.vue src/App.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts`

Expected: exit code 0.

## Task 2: Convert Rendered Text Links Into In-App Navigation Requests

**Files:**
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Modify: `frontend/src/components/article/ArticleContent.test.ts`

**Interfaces:**
- `ArticleContent` emits `openLink: [url: string]` for a normal HTTP(S) text-link activation.
- `ArticleContent` retains `retryLoadContent`, `readingProgress`, and `navigateNext` unchanged.
- `ArticleDetail` will consume `@open-link="openReaderLink"` in Task 3.

- [x] **Step 1: Replace the native-navigation test with a failing link-event test**

```ts
it('requests an in-app reader link view instead of allowing native navigation', async () => {
  const mountedReader = mountReaderWithBodyLink(
    '<p><a href="/related" target="_blank">Related</a></p>'
  );
  await flushPromises();

  const link = mountedReader.get('.prose-content a');
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  link.element.dispatchEvent(event);
  await nextTick();

  expect(event.defaultPrevented).toBe(true);
  expect(mountedReader.emitted('openLink')).toEqual([['https://example.com/related']]);
});

it('does not request an in-app reader link view for a page fragment or image link', async () => {
  const mountedReader = mountReaderWithBodyLink(`
    <p><a href="#section">Section</a></p>
    <a href="/photo"><img src="https://example.com/photo.png" alt="Photo"></a>
  `);
  await flushPromises();

  mountedReader.findAll('.prose-content a').forEach((link) => {
    link.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await nextTick();

  expect(mountedReader.emitted('openLink')).toBeUndefined();
});
```

Update the delayed-summary expectation so its URL is still normalized but its
activation also emits `openLink`. Delete the old assertions that require
`target="_self"` and a non-prevented default event.

- [x] **Step 2: Run the focused article-content test and verify it fails**

Run: `cd frontend && npm test -- --run src/components/article/ArticleContent.test.ts`

Expected: FAIL because the current implementation leaves the click unprevented
and emits no `openLink` event.

- [x] **Step 3: Implement capture-phase link interception**

```ts
const emit = defineEmits<{
  retryLoadContent: [];
  readingProgress: [percent: number];
  navigateNext: [];
  openLink: [url: string];
}>();

function handleArticleLinkClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;

  const target = event.target;
  if (!(target instanceof Element)) return;

  const link = target.closest<HTMLAnchorElement>(
    '.prose-content a[href], .summary-display a[href]'
  );
  if (!link || link.querySelector('img')) return;

  const href = resolveArticleHref(link.getAttribute('href'));
  if (!href) return;

  event.preventDefault();
  event.stopPropagation();
  emit('openLink', href);
}
```

Attach it with `@click.capture="handleArticleLinkClick"` to
`articleScrollContainer`. Keep `normalizeArticleLinks()` only for safe absolute
URL resolution; remove its `_blank` to `_self` rewrite. Do not intercept
fragment, unsupported, image, or already-prevented links.

- [x] **Step 4: Run the article-content test and verify it passes**

Run: `cd frontend && npm test -- --run src/components/article/ArticleContent.test.ts`

Expected: PASS. The resolved URL event is emitted and no top-level native
navigation path remains for ordinary text links.

- [x] **Step 5: Run the focused lint checkpoint**

Run: `cd frontend && npx eslint src/components/article/ArticleContent.vue src/components/article/ArticleContent.test.ts`

Expected: exit code 0.

## Task 3: Add a Returnable Proxied Link Layer to Article Detail

**Files:**
- Modify: `frontend/src/components/article/ArticleDetail.vue`
- Modify: `frontend/src/components/article/ArticleDetail.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- Consumes: `ArticleContent`'s `openLink(url: string)` event.
- Produces: `readerLinkUrl: Ref<string | null>` and `closeReaderLink(): void`.
- Uses: `/api/webpage/proxy?url=${encodeURIComponent(readerLinkUrl)}` with the
  same `sandbox="allow-scripts allow-same-origin allow-popups"` as the existing
  original-webpage iframe.

- [x] **Step 1: Write a failing link-layer return test**

```ts
it('returns from an in-reader link page without leaving the active reader session', async () => {
  const { wrapper, store } = await mountRenderedReaderWithLinkEmitter();
  store.setReadingMode(true);

  await wrapper.get('[data-testid="emit-reader-link"]').trigger('click');
  await nextTick();

  expect(wrapper.get('[data-testid="reader-link-preview"] iframe').attributes('src')).toContain(
    encodeURIComponent('https://example.com/related')
  );
  expect(store.isReadingMode).toBe(true);
  expect(wrapper.findComponent({ name: 'ArticleContent' }).exists()).toBe(true);

  await wrapper.get('[data-testid="return-to-reading"]').trigger('click');
  await nextTick();

  expect(wrapper.find('[data-testid="reader-link-preview"]').exists()).toBe(false);
  expect(store.currentArticleId).toBe(article.id);
  expect(store.isReadingMode).toBe(true);
  expect(wrapper.findComponent({ name: 'ArticleContent' }).exists()).toBe(true);
});
```

The `ArticleContent` stub must emit `openLink` from the named trigger. The
fixture must resolve article content as cached rendered HTML so the real
`ArticleDetail` follows the normal reader path.
Assert that opening the layer moves focus to its return control and makes the
underlying reader session inert; closing must restore focus to the initiating
link. Also reopen the layer, dispatch Escape through the loaded iframe's
`contentWindow` capture phase while its document stops bubble propagation, and
assert that it closes without changing the current article or reading-mode
state.

- [x] **Step 2: Run the focused article-detail test and verify it fails**

Run: `cd frontend && npm test -- --run src/components/article/ArticleDetail.test.ts`

Expected: FAIL because neither `reader-link-preview` nor `return-to-reading`
exists.

- [x] **Step 3: Implement the transient iframe layer and return behavior**

```ts
const readerLinkUrl = ref<string | null>(null);

function openReaderLink(url: string): void {
  readerLinkUrl.value = url;
}

function closeReaderLink(): void {
  readerLinkUrl.value = null;
}

function handleKeydown(event: KeyboardEvent): void {
  if (readerLinkUrl.value && event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeReaderLink();
    return;
  }
  // Keep the existing Cmd/Ctrl+F behavior below this branch.
}
```

Clear `readerLinkUrl` in the existing article-ID watcher so selecting another
article cannot leave a stale page over it. Pass `@open-link="openReaderLink"`
to `ArticleContent`. Change the article-detail content container to `relative`
and render a full-size `role="dialog"` overlay with
`data-testid="reader-link-preview"`, a header button with
`data-testid="return-to-reading"`, and the proxied iframe. Import
`PhArrowLeft`; use visible focus styles already used by toolbar buttons.
Move focus to the return button after opening, make the underlying session
content inert while the dialog is active, restore focus on a normal close, and
attach an Escape listener to the proxy iframe's `contentWindow` capture phase
after each load. If a later navigation makes the frame cross-origin, fail
safely and keep the visible return control available.

Add `article.readingMode.returnToReading` as **Back to reading** / **返回阅读**
and `article.readingMode.linkPreview` as **Linked page** / **链接页面**.

- [x] **Step 4: Run the article-detail test and verify it passes**

Run: `cd frontend && npm test -- --run src/components/article/ArticleDetail.test.ts`

Expected: PASS. The return action clears only the link layer while preserving
the current article and reader-mode state.

- [x] **Step 5: Run the focused lint checkpoint**

Run: `cd frontend && npx eslint src/components/article/ArticleDetail.vue src/components/article/ArticleDetail.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts`

Expected: exit code 0.

## Task 4: Verify the Reader Session End-to-End

**Files:**
- Verify only; modify implementation files only if a failing test exposes a
  concrete contract gap.

- [x] **Step 1: Run the complete focused continuity suite**

Run: `cd frontend && npm test -- --run src/App.test.ts src/components/article/ArticleContent.test.ts src/components/article/ArticleDetail.test.ts src/composables/article/useArticleDetail.test.ts src/composables/ui/useSidebarEdgeReveal.test.ts`

Expected: PASS. This includes the prior regression that switching to original
webpage keeps reader mode enabled.

- [x] **Step 2: Run the full frontend test suite**

Run: `cd frontend && npm run test:unit`

Expected: PASS with no new failures.

- [x] **Step 3: Run lint and the production frontend build**

Run: `cd frontend && npx eslint src/App.vue src/App.test.ts src/components/article/ArticleContent.vue src/components/article/ArticleContent.test.ts src/components/article/ArticleDetail.vue src/components/article/ArticleDetail.test.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts && npm run build`

Expected: exit code 0 for both commands.

- [x] **Step 4: Build the desktop application**

Run: `wails3 build`

Expected: successful macOS build. Do not replace `/Applications/MrRSS.app`
unless the user asks for another local installation.
