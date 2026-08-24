# RSS Reading Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused, accessible RSS reading mode that removes desktop navigation distractions, focuses the article reader, preserves reader context across article navigation, and has a dedicated configurable shortcut.

**Architecture:** Keep `isReadingMode` as session-only Pinia state so the layout can react without unmounting the sidebar or article list. `useArticleDetail` owns the RSS-only entry and exit lifecycle, while `ArticleContent` owns focus and reading-progress reporting for its scrollable region. `App.vue` changes only desktop visibility; the existing mobile single-column navigation remains intact.

**Tech Stack:** Vue 3 Composition API with TypeScript, Pinia, vue-i18n, Tailwind CSS, Vitest, Vue Test Utils.

## Global Constraints

- The feature applies only to the rendered RSS content view, never the original webpage iframe.
- Store reading mode only for the running app session; do not add a settings schema entry or write its value to localStorage.
- Hide the subscription sidebar and article list only at `md` and larger breakpoints, retaining their mounted instances and state.
- The RSS reader scroll container must use `tabindex="-1"`, `role="region"`, a localized name, and `focus({ preventScroll: true })`.
- Default `m` toggles reading mode; existing `v` continues to toggle RSS/original content views.
- A first Escape exits reading mode and a second Escape closes the article, while modal, image viewer, and find-in-page precedence stays unchanged.
- Do not change backend APIs, database schema, feed fetching, typography settings, theme settings, or translation settings.
- Add every new user-facing string in both `frontend/src/i18n/locales/en.ts` and `frontend/src/i18n/locales/zh.ts`.
- Preserve all unrelated worktree files and stage only the exact files named by each commit step.

---

## File Structure

- `frontend/src/stores/app.ts`: Session-only reading-mode state and one explicit state setter.
- `frontend/src/stores/app.test.ts`: Verifies the reading-mode state changes without persistence.
- `frontend/src/composables/article/useArticleDetail.ts`: Validates RSS content before entering reading mode and synchronizes exit behavior with close/original-view transitions.
- `frontend/src/composables/article/useArticleDetail.test.ts`: Covers content-required entry, original-view exit, close exit, and next-article continuity.
- `frontend/src/components/article/ArticleContent.vue`: Makes the existing RSS scroll container focusable, reports progress, and focuses only after RSS content is ready.
- `frontend/src/components/article/ArticleContent.test.ts`: Covers reader accessibility attributes, focus transfer without a scroll reset, and progress reporting.
- `frontend/src/components/article/ArticleDetail.vue`: Wires reading state into the toolbar/content, retains a localized live status, and receives progress.
- `frontend/src/components/article/ArticleToolbar.vue`: Adds the reading-mode control and uses the compact reading toolbar action set.
- `frontend/src/components/article/ArticleToolbar.test.ts`: Covers the existing webpage close control plus reading-mode action accessibility and emissions.
- `frontend/src/App.vue`: Hides only desktop navigation/list panels and the resizer while reading mode is active.
- `frontend/src/App.test.ts`: Covers responsive-mode class wiring without unmounting layout children.
- `frontend/src/composables/ui/useKeyboardShortcuts.ts`: Registers the `m` shortcut and gives reading-mode Escape behavior precedence over closing an article.
- `frontend/src/composables/ui/useKeyboardShortcuts.test.ts`: Covers `m`, unchanged `v`, and two-step Escape behavior.
- `frontend/src/components/modals/settings/shortcuts/ShortcutsTab.vue`: Exposes the configurable reading-mode shortcut with the same default as the keyboard handler.
- `frontend/src/i18n/locales/en.ts`: English reading-mode, reader-region, status, progress, and shortcut labels.
- `frontend/src/i18n/locales/zh.ts`: Simplified Chinese counterparts for all reading-mode labels.

## Interfaces

```ts
// frontend/src/stores/app.ts
isReadingMode: Ref<boolean>;
setReadingMode: (enabled: boolean) => void;

// frontend/src/components/article/ArticleContent.vue
interface Props {
  article: Article;
  articleContent: string;
  isLoadingContent: boolean;
  attachImageEventListeners?: () => void;
  showTranslations?: boolean;
  showContent?: boolean;
  isReadingMode?: boolean;
}

const emit = defineEmits<{
  retryLoadContent: [];
  readingProgress: [percent: number];
}>();

// frontend/src/components/article/ArticleToolbar.vue
interface Props {
  article: Article;
  showContent: boolean;
  showTranslations?: boolean;
  isModal?: boolean;
  isReadingMode?: boolean;
  readingProgress?: number;
}

defineEmits<{
  close: [];
  toggleContentView: [];
  toggleRead: [];
  toggleFavorite: [];
  toggleReadLater: [];
  openOriginal: [];
  toggleTranslations: [];
  reloadContent: [];
  exportToObsidian: [];
  exportToNotion: [];
  exportToZotero: [];
  toggleReadingMode: [];
}>();
```

### Task 1: Add Session Reading State And Localized Copy

**Files:**
- Modify: `frontend/src/stores/app.ts:14-64, return block near EOF`
- Create: `frontend/src/stores/app.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts:article`
- Modify: `frontend/src/i18n/locales/zh.ts:article`
- Modify: `frontend/src/i18n/locales/en.ts:shortcut.toggle`
- Modify: `frontend/src/i18n/locales/zh.ts:shortcut.toggle`

**Interfaces:**
- Consumes: existing Pinia composition store and `TranslationMessages` locale structure.
- Produces: `store.isReadingMode`, `store.setReadingMode(enabled)`, and `article.readingMode.*` / `shortcut.toggle.readingMode` translation keys used by later tasks.

- [ ] **Step 1: Write the failing session-state test**

Create a mounted Pinia host so `useSettings()` can use the i18n instance, then assert state changes never touch localStorage:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import en from '@/i18n/locales/en';
import { useAppStore } from './app';

function mountStore() {
  let store: ReturnType<typeof useAppStore> | undefined;
  mount(defineComponent({
    setup() {
      store = useAppStore();
      return () => h('div');
    },
  }), {
    global: {
      plugins: [
        createPinia(),
        createI18n({ legacy: false, locale: 'en', messages: { en } }),
      ],
    },
  });
  return store!;
}

describe('app reading mode state', () => {
  beforeEach(() => localStorage.removeItem('isReadingMode'));

  it('is session-only and can be explicitly entered and exited', () => {
    const store = mountStore();

    expect(store.isReadingMode).toBe(false);
    store.setReadingMode(true);
    expect(store.isReadingMode).toBe(true);
    expect(localStorage.getItem('isReadingMode')).toBeNull();

    store.setReadingMode(false);
    expect(store.isReadingMode).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/stores/app.test.ts`

Expected: FAIL because `isReadingMode` and `setReadingMode` are not exposed by the store.

- [ ] **Step 3: Add the minimal session state and i18n contract**

Add state and its single setter without any persistence call:

```ts
// AppState
isReadingMode: Ref<boolean>;

// AppActions
setReadingMode: (enabled: boolean) => void;

// useAppStore setup state
const isReadingMode = ref(false);

function setReadingMode(enabled: boolean): void {
  isReadingMode.value = enabled;
}

// return block
isReadingMode,
setReadingMode,
```

Add these keys to both locale files, using natural-language equivalents in each locale:

```ts
article: {
  readingMode: {
    enter: 'Enter reading mode',
    exit: 'Exit reading mode',
    entered: 'Reading mode enabled. Focus moved to the article.',
    exited: 'Reading mode exited.',
    progress: 'Reading progress: {percent}%',
    regionLabel: 'Article reader',
  },
},
shortcut: {
  toggle: {
    readingMode: 'Toggle reading mode',
  },
},
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run src/stores/app.test.ts`

Expected: PASS, including the assertion that no localStorage key is written.

- [ ] **Step 5: Commit the state and localization foundation**

```bash
git add frontend/src/stores/app.ts frontend/src/stores/app.test.ts frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/zh.ts
git commit -m "feat(reader): add session reading mode state"
```

### Task 2: Implement RSS-Only Reading-Mode Lifecycle

**Files:**
- Modify: `frontend/src/composables/article/useArticleDetail.ts:115-203,243-268,820-915`
- Create: `frontend/src/composables/article/useArticleDetail.test.ts`

**Interfaces:**
- Consumes: `store.isReadingMode`, `store.setReadingMode()`, the existing article-content endpoint, and `toggle-content-view` window event.
- Produces: `toggleReadingMode()` and `toggle-reading-mode` event handling for `ArticleDetail` and global keyboard shortcuts.

- [ ] **Step 1: Write failing lifecycle tests**

Mount a harness that calls `useArticleDetail()` under Pinia and i18n. Mock `/api/articles/content` with an RSS body for article IDs 1 and 2, then cover the required state transitions:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import { useArticleDetail } from './useArticleDetail';
import { useAppStore } from '@/stores/app';

function article(id: number): Article {
  return {
    id,
    feed_id: 1,
    title: `Article ${id}`,
    url: `https://example.com/${id}`,
    published_at: '2026-08-22T00:00:00Z',
    is_read: false,
    is_favorite: false,
    is_hidden: false,
    is_read_later: false,
  };
}

function response(data: unknown): Response {
  return { ok: true, json: async () => data } as Response;
}

const defaultFetch = vi.mocked(global.fetch).getMockImplementation();
let wrapper: ReturnType<typeof mount> | undefined;

async function mountDetailWithContent(bodies: Record<number, string>) {
  const pinia = createPinia();
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  let api: ReturnType<typeof useArticleDetail> | undefined;
  let store: ReturnType<typeof useAppStore> | undefined;

  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/articles/content?id=')) {
      const id = Number(url.split('=').at(-1));
      return response({ content: bodies[id] ?? '', cached: true });
    }
    if (url === '/api/settings') return response({ default_view_mode: 'original' });
    return response({});
  });

  wrapper = mount(defineComponent({
    setup() {
      store = useAppStore();
      api = useArticleDetail();
      return () => h('div');
    },
  }), { global: { plugins: [pinia, i18n] } });

  store!.articles = [article(1), article(2)];
  store!.currentArticleId = 1;
  await flushPromises();
  return { api: api!, store: store! };
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  if (defaultFetch) vi.mocked(global.fetch).mockImplementation(defaultFetch);
});

it('enters only when RSS content exists, preserves mode for the next article, and exits on original view', async () => {
  const { api, store } = await mountDetailWithContent({
    1: '<p>First body</p>',
    2: '<p>Second body</p>',
  });

  await api.toggleReadingMode();
  expect(store.isReadingMode).toBe(true);
  expect(api.showContent.value).toBe(true);

  store.currentArticleId = 2;
  await flushPromises();
  expect(store.isReadingMode).toBe(true);
  expect(api.showContent.value).toBe(true);

  await api.toggleContentView();
  expect(api.showContent.value).toBe(false);
  expect(store.isReadingMode).toBe(false);
});

it('does not enter reading mode for an empty RSS response and exits when the article closes', async () => {
  const { api, store } = await mountDetailWithContent({ 1: '' });

  await api.toggleReadingMode();
  expect(store.isReadingMode).toBe(false);

  store.setReadingMode(true);
  api.close();
  expect(store.currentArticleId).toBeNull();
  expect(store.isReadingMode).toBe(false);
});
```

- [ ] **Step 2: Run lifecycle tests to verify they fail**

Run: `npm test -- --run src/composables/article/useArticleDetail.test.ts`

Expected: FAIL because `toggleReadingMode` and reading-mode lifecycle exits do not exist.

- [ ] **Step 3: Add lifecycle ownership to `useArticleDetail`**

Add an RSS-only entry action that fetches current content when needed, rejects whitespace-only content with the existing localized empty-content toast, and never persists a new view preference merely for entering reader mode:

```ts
async function toggleReadingMode(): Promise<void> {
  if (store.isReadingMode) {
    store.setReadingMode(false);
    return;
  }
  if (!article.value) return;

  if (currentArticleId.value !== article.value.id || !articleContent.value.trim()) {
    await fetchArticleContent();
  }
  if (!articleContent.value.trim()) {
    window.showToast(t('article.content.noContentAvailable'), 'info');
    return;
  }

  showContent.value = true;
  store.setReadingMode(true);
}
```

Keep the state coherent from every existing transition:

```ts
function close() {
  store.setReadingMode(false);
  store.currentArticleId = null;
  showContent.value = false;
  articleContent.value = '';
  currentArticleId.value = null;
}

watch(showContent, (contentVisible) => {
  if (!contentVisible) store.setReadingMode(false);
});

function handleToggleReadingMode() {
  void toggleReadingMode();
}

window.addEventListener('toggle-reading-mode', handleToggleReadingMode);
// Remove the listener in onBeforeUnmount with the existing event cleanup.
```

In the selected-article watcher, handle `newId === null` by exiting reading mode. When `newId` changes while reading mode is already active, force `showContent.value = true` after the RSS fetch rather than applying a stored original-webpage preference; this preserves mode during adjacent article navigation.

- [ ] **Step 4: Run lifecycle tests to verify they pass**

Run: `npm test -- --run src/composables/article/useArticleDetail.test.ts`

Expected: PASS for entry validation, next-article continuity, original-view exit, and close exit.

- [ ] **Step 5: Commit the lifecycle behavior**

```bash
git add frontend/src/composables/article/useArticleDetail.ts frontend/src/composables/article/useArticleDetail.test.ts
git commit -m "feat(reader): manage RSS reading lifecycle"
```

### Task 3: Make The RSS Reader Focusable And Report Progress

**Files:**
- Modify: `frontend/src/components/article/ArticleContent.vue:40-57,1099-1197`
- Create: `frontend/src/components/article/ArticleContent.test.ts`

**Interfaces:**
- Consumes: `isReadingMode` from `ArticleDetail` and the existing scroll container / scroll-position persistence.
- Produces: a focusable reader region and `readingProgress(percent)` for `ArticleDetail`.

- [ ] **Step 1: Write failing reader-region tests**

Use `shallowMount(ArticleContent)` with the child components stubbed, an English i18n instance, and a Pinia instance. Pass `isReadingMode: true`, define the scroll metrics on the reader element, then assert its accessible region, focus, preserved scroll position, and emitted progress:

```ts
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import type { Article } from '@/types/models';
import en from '@/i18n/locales/en';
import ArticleContent from './ArticleContent.vue';

const article: Article = {
  id: 1,
  feed_id: 1,
  title: 'Example article',
  url: 'https://example.com/article',
  published_at: '2026-08-22T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_hidden: false,
  is_read_later: false,
};

function mountReader() {
  return shallowMount(ArticleContent, {
    props: {
      article,
      articleContent: '<p>Body</p>',
      isLoadingContent: false,
      isReadingMode: false,
    },
    global: {
      plugins: [
        createPinia(),
        createI18n({ legacy: false, locale: 'en', messages: { en } }),
      ],
    },
  });
}

it('focuses the RSS reader without changing its scroll position and emits progress', async () => {
  const wrapper = mountReader();
  const reader = wrapper.get('[data-testid="article-reader"]');
  Object.defineProperties(reader.element, {
    clientHeight: { value: 100, configurable: true },
    scrollHeight: { value: 500, configurable: true },
    scrollTop: { value: 200, writable: true, configurable: true },
  });

  await wrapper.setProps({ isReadingMode: true });
  await nextTick();
  await nextTick();

  expect(reader.attributes('role')).toBe('region');
  expect(reader.attributes('tabindex')).toBe('-1');
  expect(reader.attributes('aria-label')).toBe('Article reader');
  expect(document.activeElement).toBe(reader.element);
  expect((reader.element as HTMLElement).scrollTop).toBe(200);

  await reader.trigger('scroll');
  expect(wrapper.emitted('readingProgress')?.at(-1)).toEqual([50]);
});
```

- [ ] **Step 2: Run the reader-region test to verify it fails**

Run: `npm test -- --run src/components/article/ArticleContent.test.ts`

Expected: FAIL because the reader has no `data-testid`, focus semantics, or progress event.

- [ ] **Step 3: Add reader semantics, focus scheduling, and progress emission**

Extend props and events, then retain scroll persistence by keeping the existing element and scroll handler:

```ts
interface Props {
  article: Article;
  articleContent: string;
  isLoadingContent: boolean;
  attachImageEventListeners?: () => void;
  showTranslations?: boolean;
  showContent?: boolean;
  isReadingMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTranslations: true,
  attachImageEventListeners: undefined,
  showContent: true,
  isReadingMode: false,
});

const emit = defineEmits<{
  retryLoadContent: [];
  readingProgress: [percent: number];
}>();

function getReadingProgress(): number {
  const container = articleScrollContainer.value;
  if (!container) return 0;
  const scrollRange = container.scrollHeight - container.clientHeight;
  if (scrollRange <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((container.scrollTop / scrollRange) * 100)));
}

function emitReadingProgress(): void {
  if (props.isReadingMode) emit('readingProgress', getReadingProgress());
}

async function focusReaderWhenReady(): Promise<void> {
  if (!props.isReadingMode || props.isLoadingContent) return;
  await nextTick();
  if (!props.isReadingMode || props.isLoadingContent) return;
  articleScrollContainer.value?.focus({ preventScroll: true });
  emitReadingProgress();
}

watch(
  () => [props.isReadingMode, props.article.id, props.isLoadingContent] as const,
  () => void focusReaderWhenReady(),
  { immediate: true, flush: 'post' }
);

function handleReaderScroll(): void {
  scheduleSaveArticleScrollPosition();
  emitReadingProgress();
}
```

Update the existing scroll element without changing its dimensions or scrolling classes:

```vue
<div
  ref="articleScrollContainer"
  data-testid="article-reader"
  class="h-full overflow-y-scroll p-3 sm:p-6 scroll-smooth"
  tabindex="-1"
  role="region"
  :aria-label="t('article.readingMode.regionLabel')"
  @click="handleContainerClick"
  @scroll="handleReaderScroll"
>
```

- [ ] **Step 4: Run the reader-region test to verify it passes**

Run: `npm test -- --run src/components/article/ArticleContent.test.ts`

Expected: PASS with focus on the scroll container, no scroll-position mutation, and 50 percent progress.

- [ ] **Step 5: Commit reader semantics**

```bash
git add frontend/src/components/article/ArticleContent.vue frontend/src/components/article/ArticleContent.test.ts
git commit -m "feat(reader): focus RSS reading region"
```

### Task 4: Apply Focused Layout And Compact Toolbar

**Files:**
- Modify: `frontend/src/App.vue:320-345`
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/components/article/ArticleDetail.vue:1-185`
- Modify: `frontend/src/components/article/ArticleToolbar.vue:1-225`
- Modify: `frontend/src/components/article/ArticleToolbar.test.ts`

**Interfaces:**
- Consumes: `store.isReadingMode`, `toggleReadingMode()`, and `readingProgress(percent)`.
- Produces: desktop distraction-free layout, a compact reading toolbar, localized live announcements, and toolbar emissions consumed by `ArticleDetail`.

- [ ] **Step 1: Expand the existing toolbar and app tests first**

Add a reading-mode toolbar test to the existing toolbar suite:

```ts
it('exposes a pressed reading-mode control and emits an exit request', async () => {
  const wrapper = mount(ArticleToolbar, {
    props: { article, showContent: true, isReadingMode: true, readingProgress: 42 },
    global: { plugins: [i18n] },
  });

  const control = wrapper.get('[data-testid="toggle-reading-mode"]');
  expect(control.attributes('aria-pressed')).toBe('true');
  expect(control.attributes('aria-label')).toBe('Exit reading mode');
  expect(wrapper.get('[data-testid="reading-progress"]').text()).toBe('42%');

  await control.trigger('click');
  expect(wrapper.emitted('toggleReadingMode')).toHaveLength(1);
});
```

Add this complete app test using a stub root that forwards classes and other attributes:

```ts
it('hides only desktop navigation panels in reading mode', async () => {
  const createAttrStub = (name: string) => ({
    name,
    template: `<div data-stub="${name}" v-bind="$attrs"><slot /></div>`,
  });
  const pinia = createPinia();
  const wrapper = mount(App, {
    global: {
      plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        Sidebar: createAttrStub('Sidebar'),
        ArticleList: createAttrStub('ArticleList'),
        ArticleDetail: createAttrStub('ArticleDetail'),
        ImageGalleryView: createAttrStub('ImageGalleryView'),
        AddFeedModal: createAttrStub('AddFeedModal'),
        EditFeedModal: createAttrStub('EditFeedModal'),
        SettingsModal: createAttrStub('SettingsModal'),
        DiscoverFeedsModal: createAttrStub('DiscoverFeedsModal'),
        UpdateAvailableDialog: createAttrStub('UpdateAvailableDialog'),
        ContextMenu: createAttrStub('ContextMenu'),
        ConfirmDialog: createAttrStub('ConfirmDialog'),
        InputDialog: createAttrStub('InputDialog'),
        MultiSelectDialog: createAttrStub('MultiSelectDialog'),
        Toast: createAttrStub('Toast'),
      },
    },
  });
  const store = useAppStore(pinia);

  store.setReadingMode(true);
  await nextTick();

  expect(wrapper.get('.app-container').attributes('data-reading-mode')).toBe('true');
  expect(wrapper.get('[data-stub="Sidebar"]').classes()).toContain('md:hidden');
  expect(wrapper.get('[data-stub="ArticleList"]').classes()).toContain('md:hidden');
  wrapper.unmount();
});
```

- [ ] **Step 2: Run layout and toolbar tests to verify they fail**

Run: `npm test -- --run src/App.test.ts src/components/article/ArticleToolbar.test.ts`

Expected: FAIL because no reading-mode prop, control, progress indicator, or responsive hide classes exist.

- [ ] **Step 3: Wire the layout, toolbar, detail coordinator, and live status**

At the application root, retain children and hide only desktop panels:

```vue
<div
  class="app-container flex h-screen w-full bg-bg-primary text-text-primary overflow-hidden"
  :data-reading-mode="store.isReadingMode ? 'true' : 'false'"
>
  <Sidebar
    :class="{ 'md:hidden': store.isReadingMode }"
    :is-open="isSidebarOpen"
    @toggle="toggleSidebar"
  />
  <!-- Existing image-gallery branch remains unchanged. -->
  <ArticleList
    :class="{ 'md:hidden': store.isReadingMode }"
    :is-sidebar-open="isSidebarOpen"
    @toggle-sidebar="toggleSidebar"
  />
  <div v-show="!store.isReadingMode" class="resizer hidden md:block" @mousedown="startResizeArticleList" />
```

In `ArticleDetail`, consume the same store, retain the current content / detail rendering, and add a polite live status outside the `v-else` branch so exit announcements survive closing an article:

```ts
const store = useAppStore();
const readingProgress = ref(0);
const readingModeAnnouncement = ref('');

watch(() => store.isReadingMode, (enabled) => {
  readingModeAnnouncement.value = enabled
    ? t('article.readingMode.entered')
    : t('article.readingMode.exited');
});

watch(() => article.value?.id, () => {
  readingProgress.value = 0;
});
```

```vue
<span class="sr-only" aria-live="polite">{{ readingModeAnnouncement }}</span>
<ArticleToolbar
  :article="article"
  :show-content="showContent"
  :show-translations="showTranslations"
  :is-reading-mode="store.isReadingMode"
  :reading-progress="readingProgress"
  @close="close"
  @toggle-reading-mode="toggleReadingMode"
  @toggle-content-view="toggleContentView"
  @toggle-read="toggleRead"
  @toggle-favorite="toggleFavorite"
  @toggle-read-later="toggleReadLater"
  @open-original="openOriginal"
  @toggle-translations="toggleTranslations"
  @reload-content="reloadArticleContent"
  @export-to-obsidian="exportToObsidian"
  @export-to-notion="exportToNotion"
  @export-to-zotero="exportToZotero"
/>
<ArticleContent
  v-else
  :article="article"
  :article-content="articleContent"
  :is-loading-content="isLoadingContent"
  :attach-image-event-listeners="attachImageEventListeners"
  :show-translations="showTranslations"
  :show-content="showContent"
  :is-reading-mode="store.isReadingMode"
  @reading-progress="readingProgress = $event"
  @retry-load-content="handleRetryLoadContent"
/>
```

In `ArticleToolbar`, add `isReadingMode` and `readingProgress` defaults plus a `toggleReadingMode` emit. Show the reading action only for a normal, rendered RSS article; hide non-reading actions while active; keep original/RSS switching, browser open, read/favorite/read-later controls, an exit control, and progress visible:

```vue
<button
  v-if="showContent && !isModal"
  data-testid="toggle-reading-mode"
  class="action-btn"
  :aria-label="isReadingMode ? t('article.readingMode.exit') : t('article.readingMode.enter')"
  :aria-pressed="String(isReadingMode)"
  :title="isReadingMode ? t('article.readingMode.exit') : t('article.readingMode.enter')"
  @click="$emit('toggleReadingMode')"
>
  <PhBookOpen :size="18" :weight="isReadingMode ? 'fill' : 'regular'" />
</button>
<span
  v-if="isReadingMode"
  data-testid="reading-progress"
  class="min-w-10 text-right text-xs tabular-nums text-text-secondary"
  :aria-label="t('article.readingMode.progress', { percent: readingProgress })"
>{{ readingProgress }}%</span>
```

Use `v-if="!isReadingMode"` for translation, copy-link, reload, and export controls. Suppress the normal close/back controls in reading mode because the reader button is the explicit exit mechanism. Keep all controls visibly labeled through localized `title` and `aria-label` values.

- [ ] **Step 4: Run layout and toolbar tests to verify they pass**

Run: `npm test -- --run src/App.test.ts src/components/article/ArticleToolbar.test.ts`

Expected: PASS for retained component instances, desktop-only hide classes, button semantics, status data, and existing webpage close behavior.

- [ ] **Step 5: Commit the focused reader UI**

```bash
git add frontend/src/App.vue frontend/src/App.test.ts frontend/src/components/article/ArticleDetail.vue frontend/src/components/article/ArticleToolbar.vue frontend/src/components/article/ArticleToolbar.test.ts
git commit -m "feat(reader): add focused RSS reading layout"
```

### Task 5: Add Shortcut Handling, Shortcut Configuration, And Final Verification

**Files:**
- Modify: `frontend/src/composables/ui/useKeyboardShortcuts.ts:5-67,240-434`
- Create: `frontend/src/composables/ui/useKeyboardShortcuts.test.ts`
- Modify: `frontend/src/components/modals/settings/shortcuts/ShortcutsTab.vue:4-175`

**Interfaces:**
- Consumes: `store.isReadingMode`, `store.setReadingMode()`, and the `toggle-reading-mode` event registered by `useArticleDetail`.
- Produces: configurable `toggleReadingMode: 'm'` and Escape behavior consistent with the reader lifecycle.

- [ ] **Step 1: Write failing keyboard tests**

Mount a small host component that invokes `useKeyboardShortcuts()` with no-op callbacks, then assert event behavior through real bubbling keyboard events:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import en from '@/i18n/locales/en';
import { useAppStore } from '@/stores/app';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

let host: ReturnType<typeof mount> | undefined;

function mountShortcutHost() {
  const pinia = createPinia();
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  let store: ReturnType<typeof useAppStore> | undefined;
  host = mount(defineComponent({
    setup() {
      store = useAppStore();
      useKeyboardShortcuts({
        onOpenSettings: vi.fn(),
        onAddFeed: vi.fn(),
        onMarkAllRead: vi.fn().mockResolvedValue(undefined),
      });
      return () => h('div');
    },
  }), { global: { plugins: [pinia, i18n] } });
  return { store: store! };
}

afterEach(() => {
  host?.unmount();
  host = undefined;
});

it('dispatches m to toggle reading mode and preserves v for content view', () => {
  mountShortcutHost();
  const readerToggle = vi.fn();
  const contentToggle = vi.fn();
  window.addEventListener('toggle-reading-mode', readerToggle);
  window.addEventListener('toggle-content-view', contentToggle);

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }));

  expect(readerToggle).toHaveBeenCalledTimes(1);
  expect(contentToggle).toHaveBeenCalledTimes(1);

  window.removeEventListener('toggle-reading-mode', readerToggle);
  window.removeEventListener('toggle-content-view', contentToggle);
});

it('uses Escape to exit reading mode before closing the selected article', () => {
  const { store } = mountShortcutHost();
  store.currentArticleId = 1;
  store.setReadingMode(true);

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(store.isReadingMode).toBe(false);
  expect(store.currentArticleId).toBe(1);

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(store.currentArticleId).toBeNull();
});
```

Remove both temporary window listeners in `afterEach()` so they cannot affect later test files.

- [ ] **Step 2: Run shortcut tests to verify they fail**

Run: `npm test -- --run src/composables/ui/useKeyboardShortcuts.test.ts`

Expected: FAIL because `m` is not registered and Escape closes the article immediately.

- [ ] **Step 3: Implement the shortcut contract in runtime and settings UI**

Add the field to both runtime and editor interfaces/default maps:

```ts
toggleReadingMode: string;

// defaults in both files
toggleReadingMode: 'm',
```

In `useKeyboardShortcuts`, preserve modal / viewer / find-in-page priority, then make Escape use the two-step behavior:

```ts
if (key === shortcuts.value.closeArticle) {
  const findInputFocused = document.activeElement?.classList.contains('find-input');
  if (findInputFocused) return;

  const hasOpenModal = document.querySelector('[data-modal-open="true"]') !== null;
  if (!hasOpenModal && store.isReadingMode) {
    store.setReadingMode(false);
    e.preventDefault();
    return;
  }
  if (!hasOpenModal && store.currentArticleId) {
    store.currentArticleId = null;
    e.preventDefault();
  }
  return;
}
```

Add the action to the shortcut switch without changing the existing `toggleContentView` case:

```ts
case 'toggleReadingMode':
  window.dispatchEvent(new CustomEvent('toggle-reading-mode'));
  break;
case 'toggleContentView':
  window.dispatchEvent(new CustomEvent('toggle-content-view'));
  break;
```

Add the editor entry beside content view using the already imported `PhBookOpen` icon:

```ts
{ key: 'toggleReadingMode', label: t('shortcut.toggle.readingMode'), icon: PhBookOpen },
```

- [ ] **Step 4: Run shortcut tests to verify they pass**

Run: `npm test -- --run src/composables/ui/useKeyboardShortcuts.test.ts`

Expected: PASS for `m`, unchanged `v`, and two distinct Escape presses.

- [ ] **Step 5: Run complete frontend verification**

Run these commands from `frontend/`:

```bash
npm test -- --run
npx eslint src/App.vue src/stores/app.ts src/composables/article/useArticleDetail.ts src/composables/ui/useKeyboardShortcuts.ts src/components/article/ArticleContent.vue src/components/article/ArticleDetail.vue src/components/article/ArticleToolbar.vue src/components/modals/settings/shortcuts/ShortcutsTab.vue
npx prettier --check src/App.vue src/stores/app.ts src/composables/article/useArticleDetail.ts src/composables/ui/useKeyboardShortcuts.ts src/components/article/ArticleContent.vue src/components/article/ArticleDetail.vue src/components/article/ArticleToolbar.vue src/components/modals/settings/shortcuts/ShortcutsTab.vue src/stores/app.test.ts src/composables/article/useArticleDetail.test.ts src/composables/ui/useKeyboardShortcuts.test.ts src/components/article/ArticleContent.test.ts
npm run build
```

Then from the repository root:

```bash
wails3 build
git diff --check
git status --short
```

Expected: all tests, static checks, production frontend build, and Wails build pass; `git diff --check` reports no whitespace errors; status contains only the intentionally staged/committed reading-mode work plus pre-existing user files.

- [ ] **Step 6: Commit shortcut integration and verification-ready feature**

```bash
git add frontend/src/composables/ui/useKeyboardShortcuts.ts frontend/src/composables/ui/useKeyboardShortcuts.test.ts frontend/src/components/modals/settings/shortcuts/ShortcutsTab.vue
git commit -m "feat(reader): add reading mode shortcut"
```
