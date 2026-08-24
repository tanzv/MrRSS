# Reader Interaction and State Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make article selection, list status feedback, and original-page embeds accessible without changing the reader's information architecture.

**Architecture:** Keep the existing Vue component boundaries. `ArticleItem` owns keyboard activation and current-item semantics, `ArticleList` owns toolbar state and its list-level loading feedback, and each reader surface names its own iframe from the article prop. Tests exercise rendered component behavior with existing Vue Test Utils conventions.

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS, Vitest, Vite, Axe browser automation.

## Global Constraints

- Preserve the existing three-pane reader, reading mode, filters, and article selection event contract.
- Use existing i18n strings where possible and do not add a dependency.
- Maintain compact feed-reader density while preserving keyboard access and WCAG 2.1 AA semantics.
- Keep changes scoped to the reader surface and do not overwrite existing uncommitted work.

---

## Test Plan

| Code Change | File/Function | Test Change | Test File |
| --- | --- | --- | --- |
| Keyboard article selection | `ArticleItem.vue` | Assert `role`, focusability, `aria-current`, Enter and Space emissions | `ArticleItem.test.ts` |
| Toolbar state and loading feedback | `ArticleList.vue` | Assert toggle state, dialog state, named loading region, and skeleton rows | `ArticleList.test.ts` |
| Original-page iframe naming | `ArticleDetail.vue`, `ArticleDetailModal.vue` | Assert iframe title equals article title in both surfaces | `ArticleDetail.test.ts`, `ArticleDetailModal.test.ts` |

## Task 1: Article List Keyboard Contract

**Files:**
- Create: `frontend/src/components/article/ArticleItem.test.ts`
- Modify: `frontend/src/components/article/ArticleItem.vue`

**Interfaces:**
- Consumes: existing `click: []` component event and `isActive: boolean` prop.
- Produces: a focusable article item with `role="button"`, `aria-current="true"` only when active, and click-equivalent `Enter` and `Space` behavior.

- [ ] **Step 1: Write the failing test**

```ts
expect(item.attributes('role')).toBe('button');
expect(item.attributes('tabindex')).toBe('0');
expect(item.attributes('aria-current')).toBe('true');
await item.trigger('keydown.enter');
await item.trigger('keydown.space');
expect(wrapper.emitted('click')).toHaveLength(2);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/components/article/ArticleItem.test.ts`

Expected: assertions fail because the item is currently only mouse-clickable.

- [ ] **Step 3: Write minimal implementation**

```vue
<div
  role="button"
  tabindex="0"
  :aria-current="isActive ? 'true' : undefined"
  @keydown.enter="emit('click')"
  @keydown.space.prevent="emit('click')"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --run src/components/article/ArticleItem.test.ts`

Expected: PASS.

## Task 2: List Controls and Stable Loading Feedback

**Files:**
- Create: `frontend/src/components/article/ArticleList.test.ts`
- Modify: `frontend/src/components/article/ArticleList.vue`

**Interfaces:**
- Consumes: existing `store.showOnlyUnread`, `activeFilters`, `store.isLoading`, and `isFilterLoading` state.
- Produces: explicit `aria-label` / state attributes for icon controls and a `role="status"` skeleton region while the list is loading.

- [ ] **Step 1: Write the failing test**

```ts
expect(unreadToggle.attributes('aria-pressed')).toBe('true');
expect(filterToggle.attributes('aria-haspopup')).toBe('dialog');
expect(loadingRegion.attributes('role')).toBe('status');
expect(loadingRegion.findAll('[data-testid="article-list-skeleton-row"]')).toHaveLength(3);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/components/article/ArticleList.test.ts`

Expected: state attributes and skeleton rows do not yet exist.

- [ ] **Step 3: Write minimal implementation**

```vue
<div v-if="store.isLoading || isFilterLoading" role="status" :aria-label="t('common.pagination.loading')">
  <div v-for="index in 3" :key="index" data-testid="article-list-skeleton-row" />
</div>
```

Add localized `aria-label`, `aria-pressed`, `aria-haspopup="dialog"`, and `aria-expanded` bindings to the existing icon buttons without changing click handlers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --run src/components/article/ArticleList.test.ts`

Expected: PASS.

## Task 3: Name Original-Page Frames

**Files:**
- Create: `frontend/src/components/article/ArticleDetail.test.ts`
- Create: `frontend/src/components/article/ArticleDetailModal.test.ts`
- Modify: `frontend/src/components/article/ArticleDetail.vue`
- Modify: `frontend/src/components/article/ArticleDetailModal.vue`

**Interfaces:**
- Consumes: existing `article.title` prop.
- Produces: a descriptive iframe `title` in original webpage view for the pane and modal reader.

- [ ] **Step 1: Write the failing tests**

```ts
await wrapper.setData({ showContent: false });
expect(wrapper.get('iframe').attributes('title')).toBe(article.title);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/components/article/ArticleDetail.test.ts src/components/article/ArticleDetailModal.test.ts`

Expected: the iframe has no title attribute.

- [ ] **Step 3: Write minimal implementation**

```vue
<iframe :title="article.title" />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/components/article/ArticleDetail.test.ts src/components/article/ArticleDetailModal.test.ts`

Expected: PASS.

## Task 4: Integrated Reader Verification

- [ ] Run focused reader tests, full frontend tests, ESLint, Prettier, and the Vite production build.
- [ ] Run browser Axe scans on mocked populated desktop and mobile reader surfaces after selecting an article.
- [ ] Inspect screenshots for layout stability, focus visibility, sidebar density, and non-overlapping content.
