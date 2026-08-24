# Reader Continuation and Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deliberate next-article continuation, readable responsive typography, and a quieter reading-mode progress treatment without changing RSS read tracking or original-webpage behavior.

**Architecture:** Existing schema settings remain the source of truth for reader typography. A small pure frontend utility normalizes all typography values, defines the three commands, and produces CSS variables consumed by `ArticleContent` and the settings preview. `ArticleDetail` owns selected-list navigation; `ArticleContent` renders the next-article control inside its scrollable RSS surface and emits only a navigation intent. `ArticleToolbar` visualizes the already-reported reading progress without creating an additional state channel.

**Tech Stack:** Go settings generator, Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Tailwind CSS, Vitest, Playwright browser acceptance, Wails v3.

## Global Constraints

- Preserve `content_font_family`, `content_font_size`, and `content_line_height` as the only saved font, size, and line-height values.
- Add only `content_width` and `content_paragraph_spacing` as new schema-driven reading settings; run `go run tools/settings-generator/main.go` after editing the schema.
- A typography preset is a command that writes five explicit fields. It must not create a persisted selected-preset field.
- Render next-article continuation only for nonempty RSS content in active reading mode. Never auto-advance, prefetch, or alter read-state policy.
- Keep the regular details navigation unchanged outside reading mode. Hide it only while the in-content continuation is active.
- Keep the existing global themes responsible for colors. Reader preferences must not add a second color palette.
- Apply reader CSS only under `.article-reading-column`; preserve responsive media, code, tables, translations, audio, and floating TOC behavior.
- Add each user-facing string to both `frontend/src/i18n/locales/en.ts` and `frontend/src/i18n/locales/zh.ts`.
- Preserve unrelated dirty worktree changes. Do not create implementation commits from this shared dirty worktree; use scoped test commands and `git diff --check` after each task.

## File Structure

- `internal/config/settings_schema.json`: Defines two new persisted reading settings.
- Generated settings files: Carry schema defaults and types across Go, handlers, and frontend settings state.
- `frontend/src/utils/readerTypography.ts`: Normalizes reader settings, exposes preset data, and generates CSS-variable values.
- `frontend/src/utils/readerTypography.test.ts`: Covers fallback behavior, preset matching, and mapped CSS values.
- `frontend/src/components/settings/ReaderTypographyPresetPicker.vue`: Exposes the three preset commands plus the computed Custom state.
- `frontend/src/components/settings/ReaderTypographyPreview.vue`: Presents a scoped semantic sample using live typography variables.
- `frontend/src/components/modals/settings/reading/TypographySettings.vue`: Composes preset picker, preview, existing font/size/line-height controls, and new width/spacing controls.
- `frontend/src/components/modals/settings/reading/TypographySettings.test.ts`: Covers settings updates, preset application, and preview semantics.
- `frontend/src/components/article/parts/ArticleContinuation.vue`: Renders an end-of-article next preview and emits one navigation intent.
- `frontend/src/components/article/parts/ArticleContinuation.test.ts`: Verifies rendering conditions, metadata, and native button interaction.
- `frontend/src/components/article/ArticleContent.vue`: Resolves typography and renders the continuation within the RSS scroll column.
- `frontend/src/components/article/ArticleContent.test.ts`: Covers typography attributes and continuation event forwarding.
- `frontend/src/composables/article/useArticleDetail.ts`: Exposes the current next article while keeping existing navigation ownership.
- `frontend/src/components/article/ArticleDetail.vue`: Passes next article into content and hides external navigation only in reading mode.
- `frontend/src/components/article/ArticleDetail.test.ts`: Covers continuation wiring and reading-mode navigation visibility.
- `frontend/src/components/article/ArticleToolbar.vue`: Adds an accessible reading progressbar and thin visual track.
- `frontend/src/components/article/ArticleToolbar.test.ts`: Covers progress semantics and unchanged reader action behavior.
- Locale files: Supply preset, width, spacing, preview, continuation, and progress labels.

### Task 1: Add Persistent Reader Width and Paragraph Spacing

**Files:**
- Modify: `internal/config/settings_schema.json`
- Modify (generated): `config/defaults.json`, `internal/config/defaults.json`, `internal/config/config.go`, `internal/config/settings_keys.go`, `internal/handlers/settings/settings_base.go`, `frontend/src/types/settings.generated.ts`, `frontend/src/composables/core/useSettings.generated.ts`
- Create: `frontend/src/components/modals/settings/reading/TypographySettings.test.ts`
- Modify: `frontend/src/components/modals/settings/reading/TypographySettings.vue`

**Interfaces:**
- Consumes: schema generator and `SettingsData`.
- Produces: `SettingsData.content_width: string` and `SettingsData.content_paragraph_spacing: string`, each with a default of `comfortable`.

- [ ] **Step 1: Write the failing settings component test**

```ts
it('emits width and paragraph-spacing updates without changing other reader settings', async () => {
  const wrapper = mountTypographySettings({
    content_font_family: 'system',
    content_font_size: 16,
    content_line_height: '1.6',
    content_width: 'comfortable',
    content_paragraph_spacing: 'comfortable',
  });

  wrapper.findComponent('[data-testid="content-width"]').vm.$emit('update:modelValue', 'wide');
  expect(wrapper.emitted('update:settings')?.at(-1)?.[0]).toMatchObject({
    content_width: 'wide',
    content_paragraph_spacing: 'comfortable',
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd frontend && npm test -- --run src/components/modals/settings/reading/TypographySettings.test.ts
```

Expected: TypeScript or rendered-control failure because the generated settings fields and controls do not exist.

- [ ] **Step 3: Define the schema and generate code**

Add both entries under the root `settings` object:

```json
"content_paragraph_spacing": {
  "type": "string",
  "default": "comfortable",
  "category": "reading",
  "encrypted": false,
  "frontend_key": "contentParagraphSpacing"
},
"content_width": {
  "type": "string",
  "default": "comfortable",
  "category": "reading",
  "encrypted": false,
  "frontend_key": "contentWidth"
}
```

Run:

```bash
go run tools/settings-generator/main.go
```

Use the existing `SettingWithSelect` component with the test ids `content-width` and
`content-paragraph-spacing`. Its options are `narrow`/`comfortable`/`wide` and
`compact`/`comfortable`/`relaxed`, respectively. Emit the full `SettingsData` object using
the existing update pattern.

- [ ] **Step 4: Verify generated settings and the component**

Run:

```bash
go test -v ./internal/handlers/settings
cd frontend && npm test -- --run src/components/modals/settings/reading/TypographySettings.test.ts
```

Expected: generated defaults are `comfortable`; component updates only the intended field.

### Task 2: Centralize Reader Typography Values and Presets

**Files:**
- Create: `frontend/src/utils/readerTypography.ts`
- Create: `frontend/src/utils/readerTypography.test.ts`

**Interfaces:**
- Consumes: five persisted settings: font family, font size, line height, width, and paragraph spacing.
- Produces: `ReaderTypography`, `readerTypographyPresets`, `normalizeReaderTypography()`, `resolveReaderTypography()`, and `getReaderTypographyPreset()`.

- [ ] **Step 1: Write failing pure utility tests**

```ts
it('normalizes unknown values to reader defaults', () => {
  expect(resolveReaderTypography({
    content_font_family: '',
    content_font_size: 99,
    content_line_height: 'bad',
    content_width: 'edge-to-edge',
    content_paragraph_spacing: 'extra',
  })).toMatchObject({
    fontFamily: 'system',
    fontSize: 16,
    lineHeight: 1.6,
    width: 'comfortable',
    paragraphSpacing: 'comfortable',
  });
});

it('recognizes Book and returns its explicit settings payload', () => {
  const book = readerTypographyPresets.find((preset) => preset.id === 'book')!;
  expect(getReaderTypographyPreset(book.values)).toBe('book');
  expect(book.values).toEqual({
    content_font_family: 'serif',
    content_font_size: 18,
    content_line_height: '1.8',
    content_width: 'narrow',
    content_paragraph_spacing: 'relaxed',
  });
});
```

- [ ] **Step 2: Run the utility test to verify it fails**

Run:

```bash
cd frontend && npm test -- --run src/utils/readerTypography.test.ts
```

Expected: module and exported contracts do not exist.

- [ ] **Step 3: Implement the small, pure typography contract**

Use these exact value sets:

```ts
export const readerContentWidths = ['narrow', 'comfortable', 'wide'] as const;
export const readerParagraphSpacings = ['compact', 'comfortable', 'relaxed'] as const;

export const readerTypographyPresets = [
  {
    id: 'focus',
    values: {
      content_font_family: 'system',
      content_font_size: 16,
      content_line_height: '1.6',
      content_width: 'comfortable',
      content_paragraph_spacing: 'comfortable',
    },
  },
  {
    id: 'book',
    values: {
      content_font_family: 'serif',
      content_font_size: 18,
      content_line_height: '1.8',
      content_width: 'narrow',
      content_paragraph_spacing: 'relaxed',
    },
  },
  {
    id: 'compact',
    values: {
      content_font_family: 'sans-serif',
      content_font_size: 15,
      content_line_height: '1.5',
      content_width: 'wide',
      content_paragraph_spacing: 'compact',
    },
  },
] as const;
```

Clamp font size to 10 through 24, clamp line height to 1 through 3, and return CSS variable strings for `--reader-font-family`, `--reader-font-size`, `--reader-line-height`, and `--reader-paragraph-gap`. Keep width and spacing as validated data attributes rather than injecting arbitrary CSS.

- [ ] **Step 4: Verify the utility**

Run:

```bash
cd frontend && npm test -- --run src/utils/readerTypography.test.ts
```

Expected: defaults, bounds, CSS variables, all three presets, and Custom matching behave deterministically.

### Task 3: Expose Reader Presets and a Live Typography Preview

**Files:**
- Create: `frontend/src/components/settings/ReaderTypographyPresetPicker.vue`
- Create: `frontend/src/components/settings/ReaderTypographyPresetPicker.test.ts`
- Create: `frontend/src/components/settings/ReaderTypographyPreview.vue`
- Create: `frontend/src/components/settings/ReaderTypographyPreview.test.ts`
- Modify: `frontend/src/components/modals/settings/reading/TypographySettings.vue`
- Modify: `frontend/src/components/modals/settings/reading/TypographySettings.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- Consumes: `ReaderTypography` and preset values from Task 2 plus the existing `update:settings` convention.
- Produces: a labelled radiogroup-like preset command list, a labelled preview, and five explicit settings updates.

- [ ] **Step 1: Write failing picker and preview tests**

```ts
it('emits all explicit Book values from its command', async () => {
  const wrapper = mount(ReaderTypographyPresetPicker, { props: { settings } });
  await wrapper.get('[data-reader-preset="book"]').trigger('click');
  expect(wrapper.emitted('select')?.[0]).toEqual([{
    content_font_family: 'serif',
    content_font_size: 18,
    content_line_height: '1.8',
    content_width: 'narrow',
    content_paragraph_spacing: 'relaxed',
  }]);
});

it('names the preview and applies the supplied typography variables', () => {
  const wrapper = mount(ReaderTypographyPreview, { props: { typography } });
  expect(wrapper.get('[data-testid="reader-typography-preview"]').attributes('aria-label'))
    .toBe('Reader typography preview');
  expect(wrapper.get('[data-testid="reader-typography-preview"]').attributes('style'))
    .toContain('--reader-font-size: 18px');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd frontend && npm test -- --run \
  src/components/settings/ReaderTypographyPresetPicker.test.ts \
  src/components/settings/ReaderTypographyPreview.test.ts \
  src/components/modals/settings/reading/TypographySettings.test.ts
```

Expected: components and preset controls do not exist.

- [ ] **Step 3: Implement settings composition**

Render the picker before granular typography controls. It has `role="radiogroup"`; Focus, Book, and Compact are buttons with `role="radio"`, `aria-checked`, and localised names. When no preset exactly matches, provide a non-interactive `Custom` state.

Handle selection in `TypographySettings` as:

```ts
function applyPreset(values: ReaderTypographySettings): void {
  emit('update:settings', {
    ...props.settings,
    ...values,
  });
}
```

Render a semantic preview region below the controls. It uses `resolveReaderTypography()` and inline custom properties only on its own root. Do not use `v-html` or external content.

Add locale keys for preset labels/descriptions, Custom, width names/descriptions, spacing names/descriptions, preview label, next article, next article action, and reading progress label.

- [ ] **Step 4: Verify settings UI**

Run the three focused tests from Step 2. Expected: Book emits all five persisted values; a single-field change yields Custom; preview is labelled and scoped.

### Task 4: Render an Explicit Next-Article Continuation in RSS Content

**Files:**
- Create: `frontend/src/components/article/parts/ArticleContinuation.vue`
- Create: `frontend/src/components/article/parts/ArticleContinuation.test.ts`
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Modify: `frontend/src/components/article/ArticleContent.test.ts`
- Modify: `frontend/src/composables/article/useArticleDetail.ts`
- Modify: `frontend/src/components/article/ArticleDetail.vue`
- Modify: `frontend/src/components/article/ArticleDetail.test.ts`

**Interfaces:**
- Consumes: `nextArticle: Article | undefined`, `isReadingMode`, loaded RSS content, and existing `goToNextArticle()`.
- Produces: `ArticleContinuation` with `navigateNext: []`, `ArticleContent` `navigateNext: []`, and `useArticleDetail().nextArticle`.

- [ ] **Step 1: Write failing continuation and detail tests**

```ts
it('shows the next article title and emits one intent on activation', async () => {
  const wrapper = mount(ArticleContinuation, { props: { article: nextArticle } });
  expect(wrapper.text()).toContain('Next article title');
  expect(wrapper.text()).toContain('Next feed');
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('navigateNext')).toHaveLength(1);
});

it('renders continuation only for reading RSS content with a next article', async () => {
  const wrapper = mountReader({ isReadingMode: true, nextArticle });
  expect(wrapper.findComponent(ArticleContinuation).exists()).toBe(true);
  await wrapper.setProps({ isReadingMode: false });
  expect(wrapper.findComponent(ArticleContinuation).exists()).toBe(false);
});

it('hides fixed navigation while reading and reuses goToNextArticle for continuation', async () => {
  const { wrapper, store, content } = await mountDetailWithArticles([article(1), article(2)]);
  store.setReadingMode(true);
  await nextTick();

  expect(wrapper.find('[data-testid="article-navigation"]').exists()).toBe(false);
  content.vm.$emit('navigateNext');
  await nextTick();

  expect(store.currentArticleId).toBe(2);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd frontend && npm test -- --run \
  src/components/article/parts/ArticleContinuation.test.ts \
  src/components/article/ArticleContent.test.ts \
  src/components/article/ArticleDetail.test.ts
```

Expected: the component, props, event, and `nextArticle` computed value do not exist.

- [ ] **Step 3: Implement one-way continuation**

Add this computed value to `useArticleDetail`:

```ts
const nextArticle = computed<Article | undefined>(() => {
  if (!hasNextArticle.value) return undefined;
  return store.articles[currentArticleIndex.value + 1];
});
```

Expose it with existing `hasNextArticle` and `goToNextArticle`. Add optional `nextArticle` prop and `navigateNext` event to `ArticleContent`. Render `ArticleContinuation` after the existing article body when all of the following are true:

```ts
props.isReadingMode &&
!props.isLoadingContent &&
Boolean(props.articleContent.trim()) &&
Boolean(props.nextArticle)
```

`ArticleDetail` forwards the value and event. Change its fixed navigation wrapper to:

```vue
<div v-if="!store.isReadingMode && (hasPreviousArticle || hasNextArticle)">
```

The continuation button only emits the event. It does not set read state, fetch content, alter focus, or call the store directly.

- [ ] **Step 4: Verify continuation behavior**

Run the three focused tests from Step 2. Expected: the standard details path keeps its navigation; the reader path contains one next control and delegates to the existing navigation lifecycle.

### Task 5: Apply Typography to the Reader and Improve Reading Progress Feedback

**Files:**
- Modify: `frontend/src/components/article/ArticleContent.vue`
- Modify: `frontend/src/components/article/ArticleContent.css`
- Modify: `frontend/src/components/article/ArticleContent.test.ts`
- Modify: `frontend/src/components/article/ArticleToolbar.vue`
- Modify: `frontend/src/components/article/ArticleToolbar.test.ts`

**Interfaces:**
- Consumes: `resolveReaderTypography()` from Task 2 and the existing numeric `readingProgress` prop.
- Produces: scoped reader `data-content-width`, `data-paragraph-spacing`, and CSS variables; a `role="progressbar"` element with an in-range value and a visual progress track.

- [ ] **Step 1: Write failing reader CSS-contract and progress tests**

```ts
it('places validated reader typography on the reading column only', async () => {
  const wrapper = mountReader({
    settings: { content_width: 'narrow', content_paragraph_spacing: 'relaxed' },
  });
  const column = wrapper.get('[data-testid="article-reading-column"]');
  expect(column.attributes('data-content-width')).toBe('narrow');
  expect(column.attributes('data-paragraph-spacing')).toBe('relaxed');
  expect(column.attributes('style')).toContain('--reader-font-size: 16px');
});

it('exposes reader progress as a bounded progressbar and visual track', () => {
  const wrapper = mountToolbar({ isReadingMode: true, readingProgress: 42 });
  const progress = wrapper.get('[data-testid="reading-progress"]');
  expect(progress.attributes('role')).toBe('progressbar');
  expect(progress.attributes('aria-valuenow')).toBe('42');
  expect(wrapper.get('[data-testid="reading-progress-track"]').attributes('style'))
    .toContain('--reading-progress: 42%');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd frontend && npm test -- --run \
  src/components/article/ArticleContent.test.ts \
  src/components/article/ArticleToolbar.test.ts
```

Expected: reader data attributes and progressbar semantics are absent.

- [ ] **Step 3: Implement scoped typography and progress UI**

Load existing shared settings in `ArticleContent`, resolve them through Task 2, and bind only to `.article-reading-column`:

```vue
:data-content-width="readerTypography.width"
:data-paragraph-spacing="readerTypography.paragraphSpacing"
:style="readerTypography.cssVariables"
```

Define desktop widths as 58ch, 72ch, and 88ch. On screens below 640px, force `width: 100%` and keep padding on the scroll container. Apply `--reader-paragraph-gap` to direct body paragraphs and preserve existing image/table/code width protections.

In `ArticleToolbar`, clamp progress to 0 through 100. Render a bottom track only in reading mode and use the same clamped value for `aria-valuenow`, visible percentage, and `--reading-progress`. Retain every current action and event.

- [ ] **Step 4: Verify visual contracts**

Run the two focused tests from Step 2. Expected: typography is isolated to the article column; progress is accessible and remains within 0 through 100.

### Task 6: Complete Regression and Browser Acceptance

**Files:**
- No planned production changes. Repair only a failure demonstrated by the commands below in
  the file named by the failing assertion, then rerun the same focused command before moving on.

- [ ] **Step 1: Run all focused reader tests**

```bash
cd frontend && npm test -- --run \
  src/utils/readerTypography.test.ts \
  src/components/settings/ReaderTypographyPresetPicker.test.ts \
  src/components/settings/ReaderTypographyPreview.test.ts \
  src/components/modals/settings/reading/TypographySettings.test.ts \
  src/components/article/parts/ArticleContinuation.test.ts \
  src/components/article/ArticleContent.test.ts \
  src/components/article/ArticleDetail.test.ts \
  src/components/article/ArticleToolbar.test.ts
```

- [ ] **Step 2: Run full verification**

```bash
cd frontend && npm test -- --run
cd frontend && npm run build
go test -v -timeout=5m ./...
PATH="/Users/tanzv/go/bin:$PATH" /Users/tanzv/go/bin/wails3 build
git diff --check
```

- [ ] **Step 3: Run browser acceptance on desktop and mobile**

Use the local Vite server and mocked API fixture to verify:

- Book preset applies 18px, 1.8 line height, narrow width, and relaxed paragraph gap in the settings preview and RSS reader.
- A completed reading-mode article exposes the next preview, clicking it selects the next article, and the new reader obtains focus.
- Normal detail view keeps fixed navigation; reading mode hides it.
- Paper, Ink, Sepia, and High Contrast preserve readable controls and the progress track.
- At 1440px and 390px there is no visible horizontal overflow, overlapping toolbar text, or clipped next title.

- [ ] **Step 4: Inspect screenshots and report residual warnings**

Inspect the desktop and mobile screenshots. Record non-blocking environment warnings separately from implementation failures.
