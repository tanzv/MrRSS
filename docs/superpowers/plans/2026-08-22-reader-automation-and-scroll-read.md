# 自动阅读与滚动标已读实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为指定订阅源自动进入 RSS 阅读模式，并在用户选择后仅在应用内 RSS 正文读到 50% 时标记文章已读。

**Architecture:** 订阅源内容视图、会话级阅读壳层和已读时机保持独立。后端持久化 `auto_reading_mode`，设置架构生成 `mark_read_on_scroll`，新的前端文章阅读跟踪 composable 统一解析打开表面、自动阅读资格、已读请求去重和失败重试。标准详情页与卡片详情页各自负责呈现内容并向该 composable 报告文章打开和阅读进度。

**Tech Stack:** Go 1.25、SQLite、Wails HTTP API、Vue 3 Composition API、TypeScript、Pinia、vue-i18n、Vitest、Go testing。

## Global Constraints

- `auto_reading_mode` 是订阅源字段，默认 `false`；已有订阅源升级后不得自动开启阅读模式。
- `mark_read_on_scroll` 是 schema 驱动的全局布尔设置，默认 `false`，分类为 `reading`；只修改 `internal/config/settings_schema.json` 后运行 `go run tools/settings-generator/main.go`。
- 滚动阈值固定为 `50%`，不增加可调数字设置。
- 只有应用内 RSS 正文可延迟标已读；原网页 iframe、外部浏览器、悬停和明确手动已读操作保持即时。
- 有效外部浏览器视图优先于自动阅读；订阅源编辑界面必须禁用自动阅读开关并解释原因，但不得清除已保存偏好。
- 自动阅读只在当前文章的非空 RSS 内容加载成功后进入；过期请求、空内容或加载失败不得改变当前文章的视图、阅读模式或焦点。
- 自动进入阅读模式覆盖卡片布局；已有手动阅读模式快捷键、首次 Escape 退出、主题、字号、翻译和全文提取行为不变。
- `ArticleContent` 保留滚动位置和焦点职责，只报告 RSS 正文进度；不得让滚动标已读抢占正文焦点。
- 所有新增用户可见字符串同时写入 `frontend/src/i18n/locales/en.ts` 与 `frontend/src/i18n/locales/zh.ts`。
- 不提交或恢复当前工作区中与本功能无关的既有改动；每个任务只暂存其列出的文件。

---

## File Structure

- `internal/models/models.go`: 增加 `Feed.AutoReadingMode`。
- `internal/database/schema.go`, `init.go`, `migrations.go`: 新旧数据库都有默认关闭的列。
- `internal/database/feed_db.go`, `tags_db.go`: 所有新增、更新和读取路径保留该字段。
- `internal/handlers/feed/feed_handlers.go`, `internal/service/feed_service.go`, `internal/freshrss/bidirectional_sync.go`: HTTP、服务和同步写入不会重置用户偏好。
- `internal/config/settings_schema.json` 及生成文件: 定义 `mark_read_on_scroll` 的默认值、Go 类型、API 载荷和 TypeScript 类型。
- `frontend/src/types/models.ts`, `useFeedForm.ts`, `FeedFormModal.vue`, `parts/AdvancedSettings.vue`, `useFeedManagement.ts`: 编辑、提交和批量移动时保留自动阅读偏好。
- `frontend/src/components/modals/settings/reading/InteractionSettings.vue`: 暴露全局滚动标已读开关。
- `frontend/src/composables/article/useArticleReadTracking.ts` (新建): 文章表面解析、自动阅读判断、已读请求去重、乐观更新和失败重试。
- `frontend/src/composables/article/useArticleDetail.ts`: 标准详情页的自动阅读生命周期和进度转发。
- `frontend/src/components/article/ArticleContent.vue`: 向所有 RSS 正文表面报告初始、恢复后和滚动后的进度。
- `frontend/src/components/article/ArticleDetail.vue`, `ArticleDetailModal.vue`: 分别连接标准详情和卡片弹窗。
- `frontend/src/components/article/ArticleList.vue`, `useKeyboardShortcuts.ts`, `useArticleActions.ts`: 移除会绕过延迟策略的 RSS 打开即已读写入。

## Interfaces

```ts
export type ArticleViewMode = 'original' | 'rendered' | 'external';
export type ArticleSurface = 'rss' | 'webpage' | 'external';

export const READ_PROGRESS_THRESHOLD = 50;

export interface ArticleReadTracking {
  resolveViewMode(article: Article, defaultViewMode: ArticleViewMode): ArticleViewMode;
  resolveSurface(article: Article, defaultViewMode: ArticleViewMode): ArticleSurface;
  shouldAutoEnterReadingMode(article: Article, defaultViewMode: ArticleViewMode): boolean;
  handleArticleOpened(article: Article, surface: ArticleSurface): Promise<void>;
  handleReadingProgress(article: Article, percent: number): Promise<void>;
  setReadState(article: Article, isRead: boolean): Promise<void>;
}
```

```go
// Insert immediately after AutoExpandContent in models.Feed.
AutoReadingMode bool `json:"auto_reading_mode"`

// Insert immediately after AutoExpandContent in database.FeedUpdateOptions.
AutoReadingMode *bool
```

### Task 1: Persist The Per-Feed Automatic Reader Preference

**Files:**
- Modify: `internal/models/models.go`
- Modify: `internal/database/schema.go`, `internal/database/init.go`, `internal/database/migrations.go`
- Modify: `internal/database/feed_db.go`, `internal/database/tags_db.go`
- Modify: `internal/handlers/feed/feed_handlers.go`
- Modify: `internal/service/feed_service.go`, `internal/freshrss/bidirectional_sync.go`
- Modify: `internal/handlers/article/article_handlers_test.go`
- Create: `internal/database/feed_auto_reading_mode_test.go`
- Modify: `internal/handlers/feed/update_handlers_test.go`, `internal/handlers/feed/list_handlers_test.go`

**Interfaces:**
- Consumes: `Feed`, `FeedUpdateOptions`, `AddFeed`, `UpdateFeed`, `UpdateFeedWithPosition`, and feed add/update JSON.
- Produces: a SQLite `feeds.auto_reading_mode` boolean, `Feed.AutoReadingMode`, and JSON `auto_reading_mode`.

- [ ] **Step 1: Write the failing persistence tests**

Create `internal/database/feed_auto_reading_mode_test.go` in package `database_test`. Use the existing `setupTestDB(t)` helper. Cover new-feed default, explicit update, `GetFeedByID`, and `GetFeeds`:

```go
func TestFeedAutoReadingModeDefaultsAndRoundTrips(t *testing.T) {
	db := setupTestDB(t)
	feedID, err := db.AddFeed(&models.Feed{
		Title: "Reader feed",
		URL:   "https://example.com/reader.xml",
	})
	if err != nil {
		t.Fatalf("AddFeed: %v", err)
	}

	feed, err := db.GetFeedByID(feedID)
	if err != nil {
		t.Fatalf("GetFeedByID: %v", err)
	}
	if feed.AutoReadingMode {
		t.Fatal("new feed unexpectedly enables automatic reading")
	}

	enabled := true
	if err := db.UpdateFeedWithOptions(feedID, database.FeedUpdateOptions{
		AutoReadingMode: &enabled,
	}); err != nil {
		t.Fatalf("UpdateFeedWithOptions: %v", err)
	}

	feeds, err := db.GetFeeds()
	if err != nil {
		t.Fatalf("GetFeeds: %v", err)
	}
	if len(feeds) != 1 || !feeds[0].AutoReadingMode {
		t.Fatalf("GetFeeds() = %#v", feeds)
	}
}
```

Extend the feed-update test with a JSON payload containing `"auto_reading_mode": true`, then load the feed and assert `AutoReadingMode`. Extend the list-handler test to decode `[]models.Feed` and assert the response preserves `true`.

- [ ] **Step 2: Run the focused tests to verify failure**

Run:

```bash
go test -v ./internal/database -run TestFeedAutoReadingModeDefaultsAndRoundTrips
go test -v ./internal/handlers/feed -run 'TestHandle(Update|Feeds).*AutoReadingMode'
```

Expected: compile failures because the field and update option do not exist.

- [ ] **Step 3: Add the schema, queries, scans, and API field**

Add `auto_reading_mode BOOLEAN DEFAULT 0` to all three database creation/migration paths:

1. the base `CREATE TABLE IF NOT EXISTS feeds` statement in `schema.go`;
2. the idempotent `ALTER TABLE feeds ADD COLUMN` list in `init.go`;
3. the legacy `feeds_new` table and its `INSERT INTO ... SELECT` rebuild in `migrations.go`.

In `feed_db.go`, append `auto_reading_mode` after `auto_expand_content` in both `AddFeed` inserts, the duplicate-feed update SQL, `GetFeeds`, and `GetFeedByID`; append the matching value or scan destination at exactly the same position. Do the equivalent select/scan update in `tags_db.go`.

Extend `FeedUpdateOptions` and dynamic update construction:

```go
if opts.AutoReadingMode != nil {
	setParts = append(setParts, "auto_reading_mode = ?")
	args = append(args, *opts.AutoReadingMode)
}
```

Extend the `UpdateFeed` and `UpdateFeedWithPosition` function signatures with `autoReadingMode bool` immediately after `autoExpandContent`, then pass it through to `FeedUpdateOptions`. Update all callers in `feed_handlers.go`, `feed_service.go`, `bidirectional_sync.go`, and `article_handlers_test.go`. The FreshRSS call must pass `existingFeed.AutoReadingMode`, preserving local preference on synchronization.

Add `AutoReadingMode bool \`json:"auto_reading_mode"\`` to both request structs in `feed_handlers.go` and pass `req.AutoReadingMode` to `UpdateFeed`.

- [ ] **Step 4: Format and run focused tests to verify success**

Run:

```bash
gofmt -w internal/models/models.go internal/database/schema.go internal/database/init.go \
  internal/database/migrations.go internal/database/feed_db.go internal/database/tags_db.go \
  internal/handlers/feed/feed_handlers.go internal/service/feed_service.go \
  internal/freshrss/bidirectional_sync.go internal/handlers/article/article_handlers_test.go \
  internal/database/feed_auto_reading_mode_test.go internal/handlers/feed/update_handlers_test.go \
  internal/handlers/feed/list_handlers_test.go
go test -v ./internal/database -run 'TestFeedAutoReadingModeDefaultsAndRoundTrips|TestMigrationIdempotency'
go test -v ./internal/handlers/feed -run 'TestHandle(Update|Feeds).*AutoReadingMode'
go test -v ./internal/service ./internal/freshrss ./internal/handlers/article
```

Expected: all commands exit `0`; repeated initialization and all feed write paths retain the field.

- [ ] **Step 5: Commit the backend preference boundary**

```bash
git add internal/models/models.go internal/database/schema.go internal/database/init.go \
  internal/database/migrations.go internal/database/feed_db.go internal/database/tags_db.go \
  internal/handlers/feed/feed_handlers.go internal/service/feed_service.go \
  internal/freshrss/bidirectional_sync.go internal/handlers/article/article_handlers_test.go \
  internal/database/feed_auto_reading_mode_test.go internal/handlers/feed/update_handlers_test.go \
  internal/handlers/feed/list_handlers_test.go
git commit -m "feat(reader): persist per-feed automatic reading"
```

### Task 2: Generate The Scroll Preference And Expose Both Controls

**Files:**
- Modify: `internal/config/settings_schema.json`
- Modify (generated): `config/defaults.json`, `internal/config/defaults.json`, `internal/config/config.go`, `internal/config/settings_keys.go`, `internal/handlers/settings/settings_base.go`, `internal/handlers/settings/settings_handlers.go`, `frontend/src/types/settings.generated.ts`, `frontend/src/composables/core/useSettings.generated.ts`
- Modify: `frontend/src/types/models.ts`, `frontend/src/composables/feed/useFeedForm.ts`
- Modify: `frontend/src/components/modals/feed/FeedFormModal.vue`, `frontend/src/components/modals/feed/parts/AdvancedSettings.vue`, `frontend/src/composables/feed/useFeedManagement.ts`
- Modify: `frontend/src/components/modals/settings/reading/InteractionSettings.vue`
- Modify: `frontend/src/i18n/locales/en.ts`, `frontend/src/i18n/locales/zh.ts`
- Create: `frontend/src/components/modals/feed/parts/AdvancedSettings.test.ts`
- Create: `frontend/src/components/modals/settings/reading/InteractionSettings.test.ts`

**Interfaces:**
- Consumes: schema-generated `SettingsData`, `useSettings()` shared state, feed JSON from Task 1, and existing feed modal form values.
- Produces: `SettingsData.mark_read_on_scroll: boolean`, `Feed.auto_reading_mode?: boolean`, a saved global toggle, and a per-feed checkbox that disables only for external view mode.

- [ ] **Step 1: Write failing control tests**

Mount `AdvancedSettings` with a stubbed `BaseSelect`. Assert a rendered feed emits `update:autoReadingMode`, and an external feed preserves its checked value but disables the native control and displays the external-priority explanation.

```ts
it('retains automatic reading but disables its control for external viewing', () => {
  const wrapper = mount(AdvancedSettings, {
    props: {
      articleViewMode: 'external',
      autoReadingMode: true,
      autoExpandContent: 'global',
      imageGalleryEnabled: false,
      isImageMode: false,
      hideFromTimeline: false,
      proxyMode: 'global',
      proxyType: 'http',
      proxyHost: '',
      proxyPort: '',
      proxyUsername: '',
      proxyPassword: '',
      refreshMode: 'global',
      refreshInterval: 0,
    },
  });

  const input = wrapper.get('[data-testid="auto-reading-mode"]');
  expect((input.element as HTMLInputElement).checked).toBe(true);
  expect(input.attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('External browser view takes priority');
});
```

Mount `InteractionSettings`, toggle the new control, and assert its `update:settings` payload has `mark_read_on_scroll: true` without changing adjacent fields.

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
cd frontend && npm test -- --run \
  src/components/modals/feed/parts/AdvancedSettings.test.ts \
  src/components/modals/settings/reading/InteractionSettings.test.ts
```

Expected: the component props, test id, event, and settings key are absent.

- [ ] **Step 3: Add schema generation, form state, and translations**

Add this exact schema entry within the root `settings` object and run the generator from the repository root:

```json
"mark_read_on_scroll": {
  "type": "bool",
  "default": false,
  "category": "reading",
  "encrypted": false,
  "frontend_key": "mark_read_on_scroll"
}
```

```bash
go run tools/settings-generator/main.go
```

Verify generated defaults contain `false`, Go has `MarkReadOnScroll bool`, the settings key list contains `mark_read_on_scroll`, and the frontend parser/auto-save payload use booleans and strings in the same way as `hover_mark_as_read`. Do not hand-edit generated output.

Add `auto_reading_mode?: boolean` to frontend `Feed`. In `useFeedForm`, add `const autoReadingMode = ref(false)`, initialize it with `feed.auto_reading_mode === true`, reset it to `false`, return it, and write it to `body.auto_reading_mode` before submitting.

Add the prop and emit to `AdvancedSettings`, pass them through `FeedFormModal`, and render this input near Article View Mode:

```vue
<input
  data-testid="auto-reading-mode"
  :checked="props.autoReadingMode"
  :disabled="props.articleViewMode === 'external'"
  type="checkbox"
  class="toggle"
  @change="emit('update:autoReadingMode', ($event.target as HTMLInputElement).checked)"
/>
```

Show `setting.feed.autoReadingModeExternalDesc` only when the input is disabled. Preserve `auto_reading_mode` in `useFeedManagement` batch update payloads. Add the global toggle in `InteractionSettings` using `settings.mark_read_on_scroll` and the existing `updateSetting()` pattern.

Add English and Simplified Chinese strings for `setting.feed.autoReadingMode`, `setting.feed.autoReadingModeDesc`, `setting.feed.autoReadingModeExternalDesc`, `setting.reading.markReadOnScroll`, and `setting.reading.markReadOnScrollDesc`. The latter description must state the fixed 50% threshold.

- [ ] **Step 4: Run generated-settings and control tests to verify success**

Run:

```bash
go test -v ./internal/handlers/settings
cd frontend && npm test -- --run \
  src/components/modals/feed/parts/AdvancedSettings.test.ts \
  src/components/modals/settings/reading/InteractionSettings.test.ts
git diff --check -- internal/config/settings_schema.json config/defaults.json internal/config/defaults.json \
  internal/config/config.go internal/config/settings_keys.go internal/handlers/settings/settings_base.go \
  internal/handlers/settings/settings_handlers.go frontend/src/types/settings.generated.ts \
  frontend/src/composables/core/useSettings.generated.ts
```

Expected: generated files agree on default `false`; the disabled feed control preserves true; the settings UI emits a boolean.

- [ ] **Step 5: Commit generated setting and controls**

```bash
git add internal/config/settings_schema.json config/defaults.json internal/config/defaults.json \
  internal/config/config.go internal/config/settings_keys.go internal/handlers/settings/settings_base.go \
  internal/handlers/settings/settings_handlers.go frontend/src/types/settings.generated.ts \
  frontend/src/composables/core/useSettings.generated.ts frontend/src/types/models.ts \
  frontend/src/composables/feed/useFeedForm.ts frontend/src/components/modals/feed/FeedFormModal.vue \
  frontend/src/components/modals/feed/parts/AdvancedSettings.vue frontend/src/composables/feed/useFeedManagement.ts \
  frontend/src/components/modals/settings/reading/InteractionSettings.vue \
  frontend/src/components/modals/feed/parts/AdvancedSettings.test.ts \
  frontend/src/components/modals/settings/reading/InteractionSettings.test.ts \
  frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/zh.ts
git commit -m "feat(reader): add automatic reading preferences"
```

### Task 3: Centralize Article Surface And Read-State Decisions

**Files:**
- Create: `frontend/src/composables/article/useArticleReadTracking.ts`
- Create: `frontend/src/composables/article/useArticleReadTracking.test.ts`

**Interfaces:**
- Consumes: `Article`, store feeds, `settings.mark_read_on_scroll`, `/api/articles/read`, `fetchUnreadCounts()`, and `fetchFilterCounts()`.
- Produces: the `ArticleReadTracking` contract above and `READ_PROGRESS_THRESHOLD = 50`.

- [ ] **Step 1: Write failing policy tests**

Use a Pinia/i18n harness with `setSettingsFromRawData()` and a fetch mock. Cover disabled/enabled behavior, threshold, de-duplication, failure retry, manual state, and external priority.

```ts
it('waits for 50% only for unread RSS content when enabled', async () => {
  setSettingsFromRawData({ mark_read_on_scroll: 'true' });
  const { tracking } = mountTracking();
  const article = makeArticle({ is_read: false });

  await tracking.handleArticleOpened(article, 'rss');
  await tracking.handleReadingProgress(article, 49);
  expect(readRequests()).toHaveLength(0);

  await tracking.handleReadingProgress(article, 50);
  await tracking.handleReadingProgress(article, 100);
  expect(readRequests()).toHaveLength(1);
  expect(article.is_read).toBe(true);
});

it('marks webpage and external content immediately when enabled', async () => {
  setSettingsFromRawData({ mark_read_on_scroll: 'true' });
  const { tracking } = mountTracking();
  await tracking.handleArticleOpened(makeArticle({ id: 1 }), 'webpage');
  await tracking.handleArticleOpened(makeArticle({ id: 2 }), 'external');
  expect(readRequests()).toHaveLength(2);
});
```

For a failed `POST`, assert the article returns to unread and a later `handleReadingProgress(article, 50)` posts again. With a deferred first `POST`, call `setReadState(article, true)` followed by `setReadState(article, false)` and assert the second request is sent only after the first settles, leaving the final state unread. For a feed with `auto_reading_mode: true` and effective external view mode, assert `shouldAutoEnterReadingMode()` returns false.

- [ ] **Step 2: Run the policy test to verify failure**

Run:

```bash
cd frontend && npm test -- --run src/composables/article/useArticleReadTracking.test.ts
```

Expected: module-not-found failure for `useArticleReadTracking`.

- [ ] **Step 3: Implement the focused policy**

Export `resolveArticleViewMode()`, which maps feed `webpage` to `original`, accepts feed `rendered` and `external`, and otherwise returns the provided global default. `resolveSurface()` maps `rendered` to `rss`, `original` to `webpage`, and `external` to `external`. `shouldAutoEnterReadingMode()` returns true only for `feed.auto_reading_mode === true` and a non-external effective view.

Use a module-level `Map<number, PendingReadWrite>` for in-flight writes, where each entry carries the requested state and its promise. `handleArticleOpened()` calls `setReadState(article, true)` unless the current surface is RSS and `mark_read_on_scroll` is enabled. `handleReadingProgress()` calls the same write only for an unread RSS article at `percent >= 50` when the setting is enabled.

Implement the write as a per-article queue. A second request for the same state reuses the pending promise; a request for the opposite state awaits the earlier request before evaluating the current state. This prevents repeated progress events from creating duplicate POSTs and prevents a failed earlier write from rolling back a subsequent manual action:

```ts
interface PendingReadWrite {
  desired: boolean;
  token: symbol;
  promise: Promise<void>;
}

async function setReadState(article: Article, isRead: boolean): Promise<void> {
  const currentWrite = pendingWrites.get(article.id);
  if (currentWrite) {
    if (currentWrite.desired === isRead) return currentWrite.promise;
    try {
      await currentWrite.promise;
    } catch {
      // The earlier request has already restored its own optimistic state.
    }
  }

  if (article.is_read === isRead) return;

  const token = Symbol(`read-${article.id}`);
  const previous = article.is_read;
  article.is_read = isRead;

  const write = (async () => {
    try {
      const response = await fetch(`/api/articles/read?id=${article.id}&read=${isRead}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`read request failed: ${response.status}`);
      await Promise.all([store.fetchUnreadCounts(), store.fetchFilterCounts()]);
    } catch (error) {
      if (pendingWrites.get(article.id)?.token === token) article.is_read = previous;
      throw error;
    } finally {
      if (pendingWrites.get(article.id)?.token === token) pendingWrites.delete(article.id);
    }
  })();

  pendingWrites.set(article.id, { desired: isRead, token, promise: write });
  return write;
}
```

Automatic callers must catch and log errors without leaking unhandled promises; explicit `setReadState()` remains awaitable for manual controls.

- [ ] **Step 4: Run policy tests to verify success**

Run:

```bash
cd frontend && npm test -- --run src/composables/article/useArticleReadTracking.test.ts
```

Expected: no read below 50%, one write at threshold, immediate non-RSS writes, correct external priority, and retry after failure.

- [ ] **Step 5: Commit the read-state boundary**

```bash
git add frontend/src/composables/article/useArticleReadTracking.ts \
  frontend/src/composables/article/useArticleReadTracking.test.ts
git commit -m "feat(reader): centralize scroll read tracking"
```

### Task 4: Apply Automatic Reader Lifecycle In Standard Detail

**Files:**
- Modify: `frontend/src/composables/article/useArticleDetail.ts`
- Modify: `frontend/src/composables/article/useArticleDetail.test.ts`
- Modify: `frontend/src/components/article/ArticleDetail.vue`
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Modify: `frontend/src/components/article/ArticleContent.test.ts`

**Interfaces:**
- Consumes: Task 3 policy, session-only `store.isReadingMode`, article content endpoint, article view preferences, and `readingProgress`.
- Produces: automatic reader entry after current RSS content resolves and `handleReadingProgress(percent)` for `ArticleDetail`.

- [ ] **Step 1: Extend existing tests with failing reader lifecycle cases**

Add feed fixtures to `useArticleDetail.test.ts` and cover automatic reader success, external/empty fallback, stale responses, and manual exit followed by another automatic article.

```ts
it('enters reading mode only after current automatic-reader RSS content is ready', async () => {
  const { detail, store } = await mountDetailWithContent({ 1: '<p>Body</p>' }, {
    feeds: [makeFeed({ id: 1, auto_reading_mode: true, article_view_mode: 'webpage' })],
  });

  expect(detail.showContent.value).toBe(true);
  expect(store.isReadingMode).toBe(true);
});
```

Use deferred content promises: select automatic article 1, change to article 2 before resolving 1, resolve 1, and assert it did not set `isReadingMode` or alter article 2. Then resolve 2 and assert only article 2 enters.

Update `ArticleContent.test.ts` so `isReadingMode: false` still emits 50 after scroll. Give the reader `scrollHeight === clientHeight`, update it with nonempty content, and assert an initial `100` progress emission. Keep the existing focus/scroll-position assertion unchanged.

- [ ] **Step 2: Run scoped tests to verify failure**

Run:

```bash
cd frontend && npm test -- --run \
  src/composables/article/useArticleDetail.test.ts \
  src/components/article/ArticleContent.test.ts
```

Expected: automatic feeds stay in normal presentation and non-reading-mode RSS does not report progress.

- [ ] **Step 3: Route standard detail through Task 3 policy**

Replace duplicated local view-mode checks in `useArticleDetail` with Task 3 resolver calls. In the `currentArticleId` watcher, capture `targetArticleId`, await content, then reject stale completion before changing state:

```ts
const targetArticleId = newId;
const targetArticle = article.value;
if (!targetArticle || targetArticle.id !== targetArticleId) return;

await fetchArticleContent();
if (store.currentArticleId !== targetArticleId || article.value?.id !== targetArticleId) return;

const autoReader = readTracking.shouldAutoEnterReadingMode(targetArticle, defaultViewMode.value);
if (autoReader && articleContent.value.trim()) {
  showContent.value = true;
  store.setReadingMode(true);
}
```

Apply explicit context action before stored article preference, and only use a stored/default preference when reader mode is not already active and automatic reader did not enter. After resolving `showContent`, call `handleArticleOpened(targetArticle, showContent.value ? 'rss' : 'webpage')`. Do not set reader mode for an empty body or external effective view.

Remove eager calls from previous/next navigation. Route toolbar `toggleRead()` through `setReadState()`. When the user changes between RSS and webpage manually, preserve existing per-article preference, clear reader mode for webpage, and call `handleArticleOpened()` with the new surface. Remove the direct read write in `handleRenderContent`; the resolved presentation now owns the decision.

Export `handleReadingProgress(percent)` from the composable. In `ArticleDetail.vue`, bridge the event to both toolbar display and policy:

```ts
function onReadingProgress(percent: number): void {
  readingProgress.value = percent;
  void handleReadingProgress(percent);
}
```

In `ArticleContent`, remove the `isReadingMode` condition from progress emission. After a nonempty content render and after scroll-position restoration, schedule one `nextTick()` emission. Leave `focusReaderWhenReady()` gated by `isReadingMode`.

- [ ] **Step 4: Run scoped tests to verify success**

Run:

```bash
cd frontend && npm test -- --run \
  src/composables/article/useArticleDetail.test.ts \
  src/components/article/ArticleContent.test.ts \
  src/composables/article/useArticleReadTracking.test.ts
```

Expected: valid automatic content enters reader, stale and empty content cannot, manual exit only affects current article, and all RSS presentations report usable progress without focus regression.

- [ ] **Step 5: Commit the standard reader lifecycle**

```bash
git add frontend/src/composables/article/useArticleDetail.ts \
  frontend/src/composables/article/useArticleDetail.test.ts \
  frontend/src/components/article/ArticleDetail.vue \
  frontend/src/components/article/ArticleContent.vue \
  frontend/src/components/article/ArticleContent.test.ts
git commit -m "feat(reader): auto-enter RSS reader for configured feeds"
```

### Task 5: Route Card, List, Keyboard, And Context Openings Through The Policy

**Files:**
- Modify: `frontend/src/components/article/ArticleList.vue`
- Modify: `frontend/src/components/article/ArticleDetailModal.vue`
- Modify: `frontend/src/composables/ui/useKeyboardShortcuts.ts`
- Modify: `frontend/src/composables/ui/useKeyboardShortcuts.test.ts`
- Modify: `frontend/src/composables/article/useArticleActions.ts`
- Create: `frontend/src/components/article/ArticleList.test.ts`
- Create: `frontend/src/components/article/ArticleDetailModal.test.ts`

**Interfaces:**
- Consumes: Task 3 policy and Task 4 standard-detail behavior.
- Produces: automatic feeds bypass card layout, RSS selections do not write early while scroll marking is on, and card details report the same threshold behavior.

- [ ] **Step 1: Write failing opening-path tests**

Use shallow stubs for list children. In card layout, click an article whose feed has `auto_reading_mode: true`; assert `store.currentArticleId` is set and `ArticleDetailModal` is absent. With an ordinary feed, assert the card modal still exists.

```ts
it('uses standard detail rather than a card modal for an automatic-reader feed', async () => {
  const { wrapper, store } = await mountArticleList({ layout_mode: 'card' });
  store.feeds = [makeFeed({ id: 1, auto_reading_mode: true })];
  store.articles = [makeArticle({ id: 7, feed_id: 1 })];

  await wrapper.get('[data-article-id="7"]').trigger('click');

  expect(store.currentArticleId).toBe(7);
  expect(wrapper.findComponent(ArticleDetailModal).exists()).toBe(false);
});
```

In the keyboard test, enable `mark_read_on_scroll`, navigate to an unread rendered article, and assert selection occurs without a `/api/articles/read` POST. In the modal test, emit 49 then 50 from stubbed `ArticleContent` and assert only the latter POSTs for RSS; add a webpage control case that posts immediately.

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
cd frontend && npm test -- --run \
  src/components/article/ArticleList.test.ts \
  src/components/article/ArticleDetailModal.test.ts \
  src/composables/ui/useKeyboardShortcuts.test.ts
```

Expected: card mode wins for automatic feeds, keyboard navigation posts immediately, and card RSS has no threshold-aware progress handler.

- [ ] **Step 3: Update every remaining opening surface**

In `ArticleList`, resolve the surface first. Keep external browser behavior immediate, but send it through `handleArticleOpened(article, 'external')`. Bypass card mode when `shouldAutoEnterReadingMode(article, defaultViewMode.value)` is true. For standard selections, add an unread article to `temporarilyKeepArticles`, set `currentArticleId`, and delete the immediate `article.is_read = true` request; Task 4 performs the final surface decision.

```ts
const surface = readTracking.resolveSurface(article, defaultViewMode.value);
if (surface === 'external') {
  void readTracking.handleArticleOpened(article, 'external');
  openInBrowser(article.url);
  return;
}

if (isCardMode.value && !readTracking.shouldAutoEnterReadingMode(article, defaultViewMode.value)) {
  void openCardModal(article);
  return;
}

if (!article.is_read) temporarilyKeepArticles.value.add(article.id);
store.currentArticleId = article.id;
```

Remove the eager read block from `openCardModal`, retaining temporary-list state. In `ArticleDetailModal`, create its own Task 3 tracker. Once settings determine `showContent`, call `handleArticleOpened(article, showContent ? 'rss' : 'webpage')`; repeat on manual content switch. Bind `ArticleContent` progress to `handleReadingProgress()` only while `showContent` is true. Route card manual `toggleRead` through `setReadState()`.

In `useKeyboardShortcuts`, remove the eager selection write in `selectArticleByIndex`; it should set only `store.currentArticleId`. Route explicit `toggleCurrentArticleRead()` through `setReadState()`. In `useArticleActions`, delete the three duplicate automatic-read blocks for `renderContent`, `viewInAppOriginal`, and `viewInAppRendered`; Task 4 receives their explicit view event and decides the surface. Route context-menu `toggleRead` through `setReadState()`. Leave hover, image gallery, bulk marks, and read-later unchanged because each is an explicit non-RSS-reading action.

- [ ] **Step 4: Run opening-path regression tests to verify success**

Run:

```bash
cd frontend && npm test -- --run \
  src/components/article/ArticleList.test.ts \
  src/components/article/ArticleDetailModal.test.ts \
  src/composables/ui/useKeyboardShortcuts.test.ts \
  src/composables/article/useArticleDetail.test.ts \
  src/composables/article/useArticleReadTracking.test.ts
```

Expected: automatic feeds bypass cards, ordinary cards remain unchanged, RSS selection has no eager write, card RSS reaches the 50% policy, and external/manual behavior remains immediate.

- [ ] **Step 5: Commit opening-path integration**

```bash
git add frontend/src/components/article/ArticleList.vue \
  frontend/src/components/article/ArticleDetailModal.vue \
  frontend/src/composables/ui/useKeyboardShortcuts.ts \
  frontend/src/composables/ui/useKeyboardShortcuts.test.ts \
  frontend/src/composables/article/useArticleActions.ts \
  frontend/src/components/article/ArticleList.test.ts \
  frontend/src/components/article/ArticleDetailModal.test.ts
git commit -m "feat(reader): defer RSS read status until scrolling"
```

### Task 6: Validate Cross-Feature Behavior And Build Artifacts

**Files:**
- Modify only a Task 1-5 file when a verification failure identifies a scoped defect.

**Interfaces:**
- Consumes: all completed tasks and existing frontend/backend build tooling.
- Produces: verification evidence for defaults, migrations, reader focus, card behavior, keyboard navigation, and production builds.

- [ ] **Step 1: Run complete automated tests**

```bash
go test -v -timeout=5m ./...
cd frontend && npm test -- --run
```

Expected: all Go and Vitest tests pass. Record an unrelated pre-existing failure before touching it.

- [ ] **Step 2: Run static and production checks**

```bash
cd frontend && npx eslint \
  src/composables/article/useArticleReadTracking.ts \
  src/composables/article/useArticleDetail.ts \
  src/components/article/ArticleContent.vue \
  src/components/article/ArticleDetail.vue \
  src/components/article/ArticleDetailModal.vue \
  src/components/article/ArticleList.vue \
  src/composables/article/useArticleActions.ts \
  src/composables/ui/useKeyboardShortcuts.ts \
  src/components/modals/feed/FeedFormModal.vue \
  src/components/modals/feed/parts/AdvancedSettings.vue \
  src/components/modals/settings/reading/InteractionSettings.vue
cd frontend && npm run build
go build ./...
wails3 build
```

Expected: lint, frontend build, Go build, and Wails build succeed. Platform warnings may be recorded; compile, type, and lint failures must be fixed.

- [ ] **Step 3: Perform browser acceptance checks**

At desktop and mobile widths verify:

1. New feeds default to automatic reader off, and enabled preference persists after reopening edit form.
2. External browser mode disables but does not clear automatic reader, opens externally, and marks immediately.
3. Valid automatic RSS content enters reader, hides desktop navigation/list, focuses `data-testid="article-reader"`, and preserves scroll position.
4. Empty automatic RSS content does not enter reader or steal focus.
5. Disabled scroll marking reads RSS on open; enabled scroll marking stays unread at 49% and marks once at 50%.
6. Short fully visible content and restored position at/above 50% mark once.
7. Automatic feeds bypass card layout; ordinary feeds retain the card modal.
8. `M`, `V`, first Escape, navigation, explicit mark-as-read, hover marking, and original webpage behavior keep their current semantics.

- [ ] **Step 4: Review final diff and commit only scoped verification fixes**

```bash
git diff --check
git status --short
git log --oneline -6
```

If a verification-only correction is needed, stage only its task-owned files and use one of these headers:

```bash
git commit -m "fix(reader): preserve deferred read state"
git commit -m "test(reader): cover reading mode regression"
```

## Spec Coverage Review

- Per-feed automatic reader persistence and migration: Task 1.
- Schema-generated global setting, defaults, UI, external incompatibility, and i18n: Task 2.
- Fixed threshold, surface matrix, deduplication, optimistic rollback, retry, and count refresh: Task 3.
- Valid-content-only automatic entry, stale-request safety, manual exit, focus, short-content progress, and restored scroll: Task 4.
- Card precedence, list retention, keyboard selection, context actions, external behavior, and manual actions: Task 5.
- End-to-end widths, keyboard behavior, full tests, static checks, and production builds: Task 6.
