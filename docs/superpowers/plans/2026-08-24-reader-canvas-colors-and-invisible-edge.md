# 阅读画布颜色与无形边缘导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让阅读模式持久化可读的正文背景/文字颜色，同时把桌面左缘文章列表触发区改为不可见但仍可发现和键盘访问。

**Architecture:** 新增纯前端 `readerCanvas` 模型，集中处理成对颜色的归一化、对比度与局部 CSS 变量。两个设置键由 schema 生成到前后端，后端在写入前验证完整性、HEX 格式和对比度，并由 `allow_empty` 元数据支持“跟随应用主题”时清空值。颜色变量只挂在 `ArticleContent` 根元素，工具栏、侧栏、列表和链接预览继续使用应用主题。

**Tech Stack:** Go 1.25、Wails v3 HTTP settings API、SQLite、Vue 3 Composition API、TypeScript、Vitest、Tailwind CSS。

## Global Constraints

- 用户已明确授权在当前 `main` 分支和当前工作区执行；工作区已有用户/先前任务的未提交改动，绝不 reset、checkout、clean，也不暂存或提交无关内容。
- 新设置固定为 `content_background_color` 与 `content_text_color`；只接受同时为空或同时为小写不透明 `#rrggbb`，自定义对的正文对比度不低于 `4.5:1`。
- 空值表示“跟随应用主题”，必须真实写入数据库；不用 `inherit`、`null`、透明色或 CSS 表达式代替。
- 所有新增文案使用 `t()` 并补齐英语/简体中文；颜色和边缘入口都必须可键盘访问。
- 自定义颜色只作用于阅读模式 `ArticleContent` 子树；不得覆写根主题、工具栏、文章列表、侧栏或链接预览。
- 收起的左缘热区保留 16px 鼠标命中宽度，但 shell、按钮、背景、边框和阴影均透明；仅 `:focus-visible` 显示焦点轮廓。
- 新设置先改 schema，再运行 `go run tools/settings-generator/main.go`；生成的设置类型、默认值与基类文件不手工编辑。

## File Structure

- Create: `frontend/src/utils/readerCanvas.ts` 和 `readerCanvas.test.ts` — 颜色对模型、对比度与 CSS 变量。
- Create: `frontend/src/components/settings/ReaderCanvasColorControls.vue` 和 `.test.ts` — 复用的模式选择与双颜色输入。
- Create: `internal/handlers/settings/reader_canvas_validation.go` — 服务端验证和规范化。
- Modify: `internal/config/settings_schema.json`, `tools/settings-generator/main.go`, `internal/handlers/settings/settings_handlers.go`, `settings_handlers_test.go`。
- Generated: `config/defaults.json`, `internal/config/defaults.json`, `internal/config/config.go`, `internal/config/settings_keys.go`, `internal/handlers/settings/settings_base.go`, `frontend/src/types/settings.generated.ts`, `frontend/src/composables/core/useSettings.generated.ts`。
- Modify: `ReaderTypographyPreview`, `TypographySettings`, `useReaderTypographyPreferences`, `ReaderAppearancePanel`, `ArticleToolbar`, `ArticleContent`, `ArticleContent.css`, `App.vue` 及各自测试。
- Modify: `frontend/src/i18n/locales/en.ts`, `frontend/src/i18n/locales/zh.ts`, `docs/SETTINGS.md`。

---

### Task 1: 建立阅读画布纯模型

**Files:**
- Create: `frontend/src/utils/readerCanvas.ts`
- Test: `frontend/src/utils/readerCanvas.test.ts`

**Interfaces:**
- Consumes: 任意设置对象中的 `content_background_color?: unknown` 和 `content_text_color?: unknown`。
- Produces: `ReaderCanvasValues`, `ReaderCanvas`, `normalizeReaderCanvas()`, `resolveReaderCanvas()`, `calculateReaderCanvasContrast()` 与 `readerCanvasContrastPasses()`。

- [x] **Step 1: 写失败的颜色模型测试**

```ts
import { describe, expect, it } from 'vitest';
import {
  calculateReaderCanvasContrast,
  normalizeReaderCanvas,
  readerCanvasContrastPasses,
  resolveReaderCanvas,
} from './readerCanvas';

describe('reader canvas', () => {
  it('keeps only a complete lowercase opaque custom color pair', () => {
    expect(normalizeReaderCanvas({
      content_background_color: ' #F7F1E3 ',
      content_text_color: '#352C24',
    })).toEqual({
      content_background_color: '#f7f1e3',
      content_text_color: '#352c24',
    });
  });

  it('falls back to theme mode for partial, transparent, malformed, or low-contrast values', () => {
    for (const input of [
      { content_background_color: '#ffffff', content_text_color: '' },
      { content_background_color: '#ffffff00', content_text_color: '#000000' },
      { content_background_color: 'white', content_text_color: '#000000' },
      { content_background_color: '#ffffff', content_text_color: '#eeeeee' },
    ]) {
      expect(normalizeReaderCanvas(input)).toEqual({
        content_background_color: '', content_text_color: '',
      });
    }
  });

  it('exposes local variables only for a valid custom canvas', () => {
    const canvas = resolveReaderCanvas({
      content_background_color: '#111111', content_text_color: '#ffffff',
    });
    expect(canvas.mode).toBe('custom');
    expect(canvas.cssVariables).toMatchObject({
      '--reader-canvas-background': '#111111', '--reader-canvas-text': '#ffffff',
    });
    expect(calculateReaderCanvasContrast('#000000', '#777777')).toBeLessThan(4.5);
    expect(readerCanvasContrastPasses('#111111', '#ffffff')).toBe(true);
  });
});
```

- [x] **Step 2: 运行测试，确认它失败**

Run: `cd frontend && npm test -- --run src/utils/readerCanvas.test.ts`

Expected: FAIL，报 `Failed to resolve import './readerCanvas'` 或等价模块缺失错误。

- [x] **Step 3: 实现最小、无 DOM 依赖的模型**

```ts
export interface ReaderCanvasInput {
  content_background_color?: unknown;
  content_text_color?: unknown;
}

export interface ReaderCanvasValues {
  content_background_color: string;
  content_text_color: string;
}

export interface ReaderCanvas {
  mode: 'theme' | 'custom';
  values: ReaderCanvasValues;
  contrastRatio: number | null;
  cssVariables: Record<string, string>;
}

const emptyCanvas: ReaderCanvasValues = {
  content_background_color: '',
  content_text_color: '',
};
const hexColorPattern = /^#[0-9a-f]{6}$/i;

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return hexColorPattern.test(normalized) ? normalized : null;
}

function relativeLuminance(value: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function calculateReaderCanvasContrast(background: string, text: string): number {
  const normalizedBackground = normalizeHexColor(background);
  const normalizedText = normalizeHexColor(text);
  if (!normalizedBackground || !normalizedText) return Number.NaN;
  const lighter = Math.max(relativeLuminance(normalizedBackground), relativeLuminance(normalizedText));
  const darker = Math.min(relativeLuminance(normalizedBackground), relativeLuminance(normalizedText));
  return (lighter + 0.05) / (darker + 0.05);
}

export function readerCanvasContrastPasses(background: string, text: string): boolean {
  return calculateReaderCanvasContrast(background, text) >= 4.5;
}

export function normalizeReaderCanvas(input: ReaderCanvasInput): ReaderCanvasValues {
  const background = normalizeHexColor(input.content_background_color);
  const text = normalizeHexColor(input.content_text_color);
  if (!background || !text || !readerCanvasContrastPasses(background, text)) {
    return { ...emptyCanvas };
  }
  return { content_background_color: background, content_text_color: text };
}

export function resolveReaderCanvas(input: ReaderCanvasInput): ReaderCanvas {
  const values = normalizeReaderCanvas(input);
  return values.content_background_color
    ? { mode: 'custom', values, contrastRatio: calculateReaderCanvasContrast(values.content_background_color, values.content_text_color), cssVariables: {
      '--reader-canvas-background': values.content_background_color,
      '--reader-canvas-text': values.content_text_color,
    }}
    : { mode: 'theme', values, contrastRatio: null, cssVariables: {} };
}
```

Implement a private six-digit HEX parser and standard sRGB relative-luminance arithmetic (linearization threshold `0.04045`). `readerCanvasContrastPasses()` must return false for invalid input or ratio below `4.5`.

- [x] **Step 4: 运行模型测试，确认通过**

Run: `cd frontend && npm test -- --run src/utils/readerCanvas.test.ts`

Expected: PASS，3 tests、0 failures。

- [x] **Step 5: 检查任务差异**

Run: `git diff --check -- frontend/src/utils/readerCanvas.ts frontend/src/utils/readerCanvas.test.ts`

Expected: exit 0；共享工作区中不执行 `git add` 或 `git commit`。

### Task 2: 让设置系统安全持久化和清空颜色对

**Files:**
- Modify: `internal/config/settings_schema.json`, `tools/settings-generator/main.go`
- Generated: `config/defaults.json`, `internal/config/defaults.json`, `internal/config/config.go`, `internal/config/settings_keys.go`, `internal/handlers/settings/settings_base.go`, `frontend/src/types/settings.generated.ts`, `frontend/src/composables/core/useSettings.generated.ts`
- Create: `internal/handlers/settings/reader_canvas_validation.go`
- Modify: `internal/handlers/settings/settings_handlers.go`, `settings_handlers_test.go`, `docs/SETTINGS.md`

**Interfaces:**
- Consumes: `/api/settings` 的 `map[string]string`。
- Produces: schema 的 `allow_empty` 元数据、生成的 `SettingDef.AllowEmpty`，以及 `normalizeReaderCanvasSettingsRequest(settings map[string]string) error`；合法颜色在存储前转换为小写。

- [x] **Step 1: 为后端 round-trip、清空和拒绝行为写失败测试**

```go
func TestHandleSettingsReaderCanvasRoundTripAndClear(t *testing.T) {
	h := setupHandlerWithDB(t)
	post := func(payload map[string]string) *httptest.ResponseRecorder {
		body, err := json.Marshal(payload)
		if err != nil { t.Fatal(err) }
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		HandleSettings(h, recorder, req)
		return recorder
	}

	if response := post(map[string]string{
		"content_background_color": "#F7F1E3",
		"content_text_color": "#352C24",
	}); response.Code != http.StatusOK {
		t.Fatalf("custom status = %d: %s", response.Code, response.Body.String())
	}
	if got, _ := h.DB.GetSetting("content_background_color"); got != "#f7f1e3" {
		t.Fatalf("background = %q", got)
	}
	if response := post(map[string]string{
		"content_background_color": "", "content_text_color": "",
	}); response.Code != http.StatusOK {
		t.Fatalf("clear status = %d: %s", response.Code, response.Body.String())
	}
	if got, _ := h.DB.GetSetting("content_text_color"); got != "" {
		t.Fatalf("text after clear = %q", got)
	}
}

func TestHandleSettingsRejectsInvalidReaderCanvas(t *testing.T) {
	for name, payload := range map[string]map[string]string{
		"partial": {"content_background_color": "#ffffff"},
		"alpha": {"content_background_color": "#ffffff00", "content_text_color": "#000000"},
		"named": {"content_background_color": "white", "content_text_color": "#000000"},
		"low contrast": {"content_background_color": "#ffffff", "content_text_color": "#eeeeee"},
	} {
		t.Run(name, func(t *testing.T) {
			h := setupHandlerWithDB(t)
			body, _ := json.Marshal(payload)
			recorder := httptest.NewRecorder()
			HandleSettings(h, recorder, httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(body)))
			if recorder.Code != http.StatusBadRequest { t.Fatalf("status = %d: %s", recorder.Code, recorder.Body.String()) }
		})
	}
}
```

- [x] **Step 2: 运行测试，确认当前行为失败**

Run: `go test ./internal/handlers/settings -run 'TestHandleSettings(ReaderCanvasRoundTripAndClear|RejectsInvalidReaderCanvas)' -count=1`

Expected: FAIL；当前 API 会接受不完整/低对比度颜色，并跳过空字符串保存。

- [x] **Step 3: 声明颜色设置与允许空值的 schema 元数据**

Add these entries adjacent to the existing `content_*` keys:

```json
"content_background_color": {
  "type": "string",
  "default": "",
  "category": "reading",
  "encrypted": false,
  "allow_empty": true,
  "frontend_key": "contentBackgroundColor"
},
"content_text_color": {
  "type": "string",
  "default": "",
  "category": "reading",
  "encrypted": false,
  "allow_empty": true,
  "frontend_key": "contentTextColor"
}
```

Extend the generator’s schema definition and settings-base template:

```go
type SettingDef struct {
	Type        string      `json:"type"`
	Default     interface{} `json:"default"`
	Category    string      `json:"category"`
	Encrypted   bool        `json:"encrypted"`
	AllowEmpty  bool        `json:"allow_empty"`
	FrontendKey string      `json:"frontend_key"`
}

type SettingDef struct {
	Key        string
	Encrypted  bool
	AllowEmpty bool
}
```

Generate definitions as `{Key: key, Encrypted: def.Encrypted, AllowEmpty: def.AllowEmpty}`. In generated `SaveSettings`, build both encrypted and allow-empty lookups, then use `else if value != "" || allowEmptyKeys[key] { h.DB.SetSetting(key, value) }`. This deliberately preserves the old skip-empty behavior for every existing setting.

Run: `go run tools/settings-generator/main.go`

- [x] **Step 4: 实现后端规范化与校验**

Create `reader_canvas_validation.go` with a private six-digit HEX regexp, `parseReaderCanvasHex`, `readerCanvasContrastRatio`, and this entry point:

```go
func normalizeReaderCanvasSettingsRequest(settings map[string]string) error {
	background, hasBackground := settings["content_background_color"]
	text, hasText := settings["content_text_color"]
	if !hasBackground && !hasText { return nil }
	if !hasBackground || !hasText {
		return fmt.Errorf("reader canvas colors must be provided together")
	}
	background = strings.ToLower(strings.TrimSpace(background))
	text = strings.ToLower(strings.TrimSpace(text))
	if background == "" && text == "" {
		settings["content_background_color"] = ""
		settings["content_text_color"] = ""
		return nil
	}
	if !readerCanvasColorPattern.MatchString(background) || !readerCanvasColorPattern.MatchString(text) {
		return fmt.Errorf("reader canvas colors must be six-digit hex colors")
	}
	if readerCanvasContrastRatio(background, text) < 4.5 {
		return fmt.Errorf("reader canvas colors must meet 4.5:1 contrast")
	}
	settings["content_background_color"] = background
	settings["content_text_color"] = text
	return nil
}
```

Use the same sRGB luminance arithmetic as Task 1. In `HandleSettings`, call it directly after JSON decoding and return `response.Error(..., http.StatusBadRequest)` before the FreshRSS branch or `SaveSettings`. GET must not rewrite old malformed DB rows; Task 1 will render them as theme mode.

- [x] **Step 5: 文档与后端验证**

Update `docs/SETTINGS.md` to explain that the two reader canvas keys are paired, empty values follow the app theme, a complete opaque pair must meet `4.5:1`, and `allow_empty` permits a schema setting to overwrite an existing stored string with `""`.

Run:

```bash
git diff --check -- internal/config/settings_schema.json tools/settings-generator/main.go config/defaults.json internal/config frontend/src/types/settings.generated.ts frontend/src/composables/core/useSettings.generated.ts internal/handlers/settings docs/SETTINGS.md
go test ./internal/handlers/settings -run 'TestHandleSettings(ReaderCanvasRoundTripAndClear|RejectsInvalidReaderCanvas)' -count=1
go test ./internal/handlers/settings -count=1
```

Expected: all commands exit 0; generated payload/types include both fields and empty-pair clearing survives a GET.

### Task 3: 实现可复用颜色控件和实时预览

**Files:**
- Create: `frontend/src/components/settings/ReaderCanvasColorControls.vue`
- Test: `frontend/src/components/settings/ReaderCanvasColorControls.test.ts`
- Modify/Test: `frontend/src/components/settings/ReaderTypographyPreview.vue`, `ReaderTypographyPreview.test.ts`
- Modify/Test: `frontend/src/components/modals/settings/reading/TypographySettings.vue`, `TypographySettings.test.ts`
- Modify: `frontend/src/i18n/locales/en.ts`, `frontend/src/i18n/locales/zh.ts`

**Interfaces:**
- Consumes: `ReaderCanvasInput`, `ReaderCanvasValues`, `ReaderCanvas`, `resolveReaderCanvas()` from Task 1.
- Produces: `ReaderCanvasColorControls` event `update:canvas` carrying a complete valid pair only; `ReaderTypographyPreview` optional prop `canvas?: ReaderCanvas`.

- [x] **Step 1: 写失败的控件和预览测试**

```ts
it('seeds a valid pair on custom mode and clears both fields on theme mode', async () => {
  document.documentElement.style.setProperty('--bg-primary', '#f7f1e3');
  document.documentElement.style.setProperty('--text-primary', '#352c24');
  const wrapper = mount(ReaderCanvasColorControls, {
    props: { canvas: { content_background_color: '', content_text_color: '' } },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
  await wrapper.get('[data-testid="reader-canvas-mode-custom"]').trigger('click');
  expect(wrapper.emitted('update:canvas')?.at(-1)).toEqual([{
    content_background_color: '#f7f1e3', content_text_color: '#352c24',
  }]);
  await wrapper.get('[data-testid="reader-canvas-mode-theme"]').trigger('click');
  expect(wrapper.emitted('update:canvas')?.at(-1)).toEqual([{
    content_background_color: '', content_text_color: '',
  }]);
});

it('keeps a low-contrast draft local and exposes an accessible warning', async () => {
  const wrapper = mount(ReaderCanvasColorControls, {
    props: { canvas: { content_background_color: '#ffffff', content_text_color: '#111111' } },
  });
  await wrapper.get('[data-testid="reader-canvas-text-input"]').setValue('#eeeeee');
  expect(wrapper.emitted('update:canvas')).toBeUndefined();
  expect(wrapper.get('[data-testid="reader-canvas-contrast"]').attributes('aria-invalid')).toBe('true');
});

it('merges canvas variables into the typography preview', () => {
  const wrapper = mount(ReaderTypographyPreview, {
    props: {
      typography: resolveReaderTypography({}),
      canvas: resolveReaderCanvas({ content_background_color: '#111111', content_text_color: '#ffffff' }),
    },
  });
  const preview = wrapper.get('[data-testid="reader-typography-preview"]');
  expect(preview.attributes('data-reader-canvas')).toBe('custom');
  expect(preview.attributes('style')).toContain('--reader-canvas-background: #111111');
  expect(preview.attributes('style')).toContain('--reader-font-size: 16px');
});
```

Extend `TypographySettings.test.ts` with a stubbed `ReaderCanvasColorControls` emit. Assert the existing `update:settings` event contains both custom fields while retaining the original five typography values.

- [x] **Step 2: 运行测试，确认当前代码失败**

Run:

```bash
cd frontend && npm test -- --run src/components/settings/ReaderCanvasColorControls.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/modals/settings/reading/TypographySettings.test.ts
```

Expected: FAIL because the control module and preview `canvas` prop do not exist.

- [x] **Step 3: 实现原子颜色对控件**

Create the component with this contract; do not reuse `ThemeColorField`, because it accepts eight-digit colors and emits individual token updates:

```ts
defineProps<{ canvas: ReaderCanvasInput }>();
const emit = defineEmits<{
  'update:canvas': [value: ReaderCanvasValues];
}>();
```

Maintain local background/text draft refs initialized from `normalizeReaderCanvas(props.canvas)`. Render two labelled mode buttons (`reader-canvas-mode-theme`, `reader-canvas-mode-custom`) with `aria-pressed`. In custom mode render two `type="color"` swatches and two `type="text"` fields (`reader-canvas-background-input`, `reader-canvas-text-input`) with visible labels and value text. Read `--bg-primary`/`--text-primary` from `getComputedStyle(document.documentElement)` only when entering custom mode, normalize the pair, and emit it when valid. On all field input use the following complete-pair gate:

```ts
function commitIfReadable(): void {
  const canvas = normalizeReaderCanvas({
    content_background_color: backgroundDraft.value,
    content_text_color: textDraft.value,
  });
  const isCustom = Boolean(canvas.content_background_color);
  invalid.value = !isCustom;
  if (isCustom) emit('update:canvas', canvas);
}
```

When invalid, retain drafts locally, set `aria-invalid` on `reader-canvas-contrast`, and render the locale warning; do not emit, mutate parent settings, or schedule a save. Watch `props.canvas` and reset drafts after a valid parent change. Clicking theme mode emits exactly two empty strings.

- [x] **Step 4: 扩展预览和设置页**

Change preview props and inline style to merge typography and canvas variables:

```ts
const props = defineProps<{ typography: ReaderTypography; canvas?: ReaderCanvas }>();
const previewStyle = computed(() => ({
  ...props.typography.cssVariables,
  ...(props.canvas?.cssVariables ?? {}),
}));
```

Set `data-reader-canvas="canvas?.mode ?? 'theme'"`. In preview scoped CSS, only the custom selector may set `background`, `color`, `--text-primary`, `--text-secondary`, and `--border-color`; derive secondary/border values via `color-mix(in srgb, var(--reader-canvas-text) ..., var(--reader-canvas-background))`.

In `TypographySettings.vue`, compute `readerCanvas = resolveReaderCanvas(props.settings)`, place the new control after paragraph spacing and before the preview, and merge emitted values with current settings:

```vue
<ReaderCanvasColorControls
  :canvas="settings"
  @update:canvas="(canvas) => emit('update:settings', { ...settings, ...canvas })"
/>
<ReaderTypographyPreview :typography="readerTypography" :canvas="readerCanvas" />
```

- [x] **Step 5: 本地化并验证 Task 3**

Add matching English/Chinese keys: `appearance` → “Reading appearance”/“阅读外观”; `appearanceClose`, `appearanceSaveFailed`, `appearanceTitle`; plus `readerCanvas`, `readerCanvasTheme`, `readerCanvasCustom`, `readerCanvasBackground`, `readerCanvasText`, `readerCanvasContrast`, and `readerCanvasContrastInvalid`. Chinese text uses `阅读颜色`、`跟随应用主题`、`自定义阅读画布`、`背景色`、`正文字色`、`正文对比度：{ratio}:1`、`请选择对比度至少为 4.5:1 的颜色`.

Run:

```bash
cd frontend && npm test -- --run src/components/settings/ReaderCanvasColorControls.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/modals/settings/reading/TypographySettings.test.ts
rg -n "readerCanvas(Theme|Custom|Background|Text|Contrast)" src/i18n/locales/en.ts src/i18n/locales/zh.ts
```

Expected: tests pass; every queried locale key appears once in each locale.

### Task 4: 将颜色接入阅读内 Aa 面板、保存队列和正文作用域

**Files:**
- Modify/Test: `frontend/src/composables/article/useReaderTypographyPreferences.ts`, `.test.ts`
- Modify/Test: `frontend/src/components/article/ReaderAppearancePanel.vue`, `.test.ts`
- Modify/Test: `frontend/src/components/article/ArticleToolbar.vue`, `.test.ts`
- Modify/Test: `frontend/src/components/article/ArticleContent.vue`, `.test.ts`
- Modify: `frontend/src/components/article/ArticleContent.css`

**Interfaces:**
- Consumes: generated settings fields and the Task 1 reader canvas model.
- Produces: `updateCanvas(values: ReaderCanvasValues)` from existing preferences, a panel `update-canvas` event, and `data-testid="article-reader-canvas"` scoped custom variables.

- [x] **Step 1: 写失败的保存、面板和作用域测试**

```ts
it('debounces one valid canvas pair into the shared settings payload', async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({ ok: true } as Response);
  const { preferences, settings } = mountPreferences({ request, debounceMs: 500 });
  preferences.updateCanvas({ content_background_color: '#111111', content_text_color: '#ffffff' });
  expect(settings.value.content_background_color).toBe('#111111');
  await vi.advanceTimersByTimeAsync(500);
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    content_background_color: '#111111', content_text_color: '#ffffff',
  }));
});

it('forwards a complete canvas pair from the reader appearance panel', () => {
  const wrapper = mountPanel({ mobile: false });
  wrapper.findComponent(ReaderCanvasColorControls).vm.$emit('update:canvas', {
    content_background_color: '#111111', content_text_color: '#ffffff',
  });
  expect(wrapper.emitted('update-canvas')).toEqual([[
    { content_background_color: '#111111', content_text_color: '#ffffff' },
  ]]);
});

it('uses custom canvas variables only while article content is in reading mode', async () => {
  setSettingsFromRawData({ content_background_color: '#111111', content_text_color: '#ffffff' });
  const reader = mountReader('<p>Body</p>', { isReadingMode: true });
  const canvas = reader.get('[data-testid="article-reader-canvas"]');
  expect(canvas.attributes('data-reader-canvas')).toBe('custom');
  expect(canvas.attributes('style')).toContain('--reader-canvas-background: #111111');
  expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('');
  await reader.setProps({ isReadingMode: false });
  expect(canvas.attributes('data-reader-canvas')).toBe('theme');
});
```

Extend `ArticleToolbar.test.ts` so an `update-canvas` event from the stubbed panel invokes the new preferences method and retains existing focus restoration after close.

- [x] **Step 2: 运行测试，确认新 API 和 DOM 标识失败**

Run:

```bash
cd frontend && npm test -- --run src/composables/article/useReaderTypographyPreferences.test.ts src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.test.ts src/components/article/ArticleContent.test.ts
```

Expected: FAIL because `updateCanvas`, `update-canvas`, and `article-reader-canvas` are absent.

- [x] **Step 3: 复用既有防抖保存器而不建立第二个网络队列**

```ts
import type { ReaderCanvasValues } from '@/utils/readerCanvas';

export interface ReaderTypographyPreferences {
  // all existing members stay unchanged
  updateCanvas: (values: ReaderCanvasValues) => void;
}

function updateCanvas(values: ReaderCanvasValues): void {
  settings.value = { ...settings.value, ...values };
  isDirty = true;
  scheduleSave();
}
```

Keep `updateTypography`, presets, restore-default-typography, flush, retry, save error and `settings-updated` behaviour unchanged. The Task 3 control guarantees a valid atomic pair, so this method must not split the values or add a divergent second validation.

In `ReaderAppearancePanel.vue`, extend its setting input with `ReaderCanvasInput`, compute `readerCanvas = resolveReaderCanvas(props.settings)`, add an `update-canvas` emit, render `<ReaderCanvasColorControls :canvas="settings" @update:canvas="emit('update-canvas', $event)" />` after width and before preview, and pass `:canvas="readerCanvas"` to `ReaderTypographyPreview`.

In `ArticleToolbar.vue`, destructure `updateCanvas` and wire it into the existing panel:

```vue
<ReaderAppearancePanel
  :settings="settings"
  :save-error="saveError"
  @update-typography="updateTypography"
  @update-canvas="updateCanvas"
  @restore-default-typography="restoreDefaultTypography"
  @retry-save="retrySave"
/>
```

- [x] **Step 4: 限定阅读画布的变量与派生表面**

In `ArticleContent.vue`, derive the model only for active reader mode and attach it to the existing outer content region:

```ts
const readerCanvas = computed(() =>
  props.isReadingMode ? resolveReaderCanvas(appSettings.value) : resolveReaderCanvas({})
);
```

```vue
<div
  data-testid="article-reader-canvas"
  class="article-reader-canvas relative flex-1 overflow-hidden bg-bg-primary text-text-primary"
  :data-reader-canvas="readerCanvas.mode"
  :style="readerCanvas.cssVariables"
>
```

Add this narrow `ArticleContent.css` rule; it must never appear on `:root`:

```css
.article-reader-canvas[data-reader-canvas='custom'] {
  --bg-primary: var(--reader-canvas-background);
  --bg-secondary: color-mix(in srgb, var(--reader-canvas-background) 90%, var(--reader-canvas-text));
  --bg-tertiary: color-mix(in srgb, var(--reader-canvas-background) 82%, var(--reader-canvas-text));
  --text-primary: var(--reader-canvas-text);
  --text-secondary: color-mix(in srgb, var(--reader-canvas-text) 72%, var(--reader-canvas-background));
  --text-tertiary: color-mix(in srgb, var(--reader-canvas-text) 58%, var(--reader-canvas-background));
  --border-color: color-mix(in srgb, var(--reader-canvas-text) 24%, var(--reader-canvas-background));
  --code-bg-color: color-mix(in srgb, var(--reader-canvas-background) 86%, var(--reader-canvas-text));
  --code-border-color: color-mix(in srgb, var(--reader-canvas-text) 28%, var(--reader-canvas-background));
  --syntax-plain: var(--reader-canvas-text);
}
```

Do not override accent, semantic state, image/video colors, `body`, or root variables. Existing title, summary, prose, quote, code, list marker, and continuation classes inherit local aliases; `ArticleToolbar` is a sibling and keeps its theme.

- [x] **Step 5: 验证阅读内路径**

Run:

```bash
cd frontend && npm test -- --run src/composables/article/useReaderTypographyPreferences.test.ts src/components/article/ReaderAppearancePanel.test.ts src/components/article/ArticleToolbar.test.ts src/components/article/ArticleContent.test.ts src/components/settings/ReaderCanvasColorControls.test.ts src/components/settings/ReaderTypographyPreview.test.ts src/components/modals/settings/reading/TypographySettings.test.ts
```

Expected: PASS; close/escape/focus behavior and existing link-preview return tests remain green.

### Task 5: 修复左缘可见色条，同时保留临时展开与键盘路径

**Files:**
- Modify: `frontend/src/App.vue`
- Test: `frontend/src/App.test.ts`

**Interfaces:**
- Consumes: 现有 `useSidebarEdgeReveal` 的 pointer/focus/leave 方法。
- Produces: 相同的 `reader-article-list-edge` 可访问按钮和 `is-revealed` 行为；收起视觉状态为透明。

- [x] **Step 1: 写失败的可见色条与键盘回归测试**

Add at the top of `App.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');
```

Then add this test and focus assertion:

```ts
it('keeps the collapsed reader edge visually transparent', () => {
  expect(appSource).toMatch(/\.reader-article-list-edge-shell\s*\{[\s\S]*?background-color:\s*transparent;/);
  expect(appSource).toMatch(/\.reader-article-list-edge-trigger\s*\{[\s\S]*?background:\s*transparent;/);
  expect(appSource).not.toContain('background: color-mix(in srgb, var(--accent-color) 55%, transparent)');
});

it('reveals the article list when the invisible edge receives keyboard focus', async () => {
  const { wrapper, store, restoreMatchMedia } = mountDesktopApp();
  try {
    store.setReadingMode(true);
    await nextTick();
    await wrapper.get('[data-testid="reader-article-list-edge"]').trigger('focusin');
    expect(wrapper.get('[data-testid="reading-article-list-container"]').classes()).toContain('is-revealed');
  } finally {
    wrapper.unmount();
    restoreMatchMedia();
  }
});
```

- [x] **Step 2: 运行测试，确认当前强调色条会失败**

Run: `cd frontend && npm test -- --run src/App.test.ts`

Expected: FAIL at `keeps the collapsed reader edge visually transparent`; current source contains the asserted accent `color-mix` background.

- [x] **Step 3: 只改变静止视觉层，保留行为**

Keep all positioning, 16px width, z-index, transition, list visibility, handlers, 180ms release, mobile gate, and article-selection watcher. Replace only resting paint:

```css
.reader-article-list-edge-shell {
  background-color: transparent;
  box-shadow: none;
}

.reader-article-list-edge-trigger {
  background: transparent;
  opacity: 1;
}

.reader-article-list-edge-trigger:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}
```

Retain revealed-state width and overlay shadow. Parent `:focus-within` outline may remain, but no mouse-at-rest selector may add a visible fill or border.

- [x] **Step 4: 验证边缘和共享 reveal composable**

Run:

```bash
cd frontend && npm test -- --run src/App.test.ts src/composables/ui/useSidebarEdgeReveal.test.ts
```

Expected: PASS; pointer entry, keyboard focus, delayed leave, touch exclusion, and article-selection retraction remain covered.

### Task 6: 全面验证、人工验收与交付状态

**Files:**
- Modify only when a concrete verification failure requires a scoped correction.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: fresh evidence for unit tests, production build, Go suite, Wails build, and the user-visible reading flow.

- [x] **Step 1: 运行完整前端测试与生产构建**

Run: `cd frontend && npm test`

Expected: exit 0. Then run: `cd frontend && npm run build`

Expected: exit 0. If an unrelated pre-existing failure appears, record the exact failing test and do not modify unrelated source to suppress it.

- [x] **Step 2: 运行完整 Go 测试与桌面构建**

Run: `go test -v -timeout=5m ./...`

Expected: exit 0. Then run: `wails3 build`

Expected: exit 0. Keep the generated application bundle; install or overwrite `/Applications/MrRSS.app` only if the user asks after verification.

- [ ] **Step 3: 执行明确的人工阅读验收**

1. 在 Paper、Ink、Sepia、高对比度和一个自定义应用主题中，未配置时阅读画布均跟随相应应用主题。
2. 在 `Aa` 面板和“设置 → 阅读”各选择 `#111111 / #ffffff`：当前文章、下一篇、标题、正文、摘要、引用、代码、列表标记和续读提示改变；工具栏、文章列表、侧栏和链接预览不变色。
3. 输入 `#ffffff / #eeeeee`、八位 HEX 和单字段值：出现可读提示且不会保存；切回“跟随应用主题”后重新读取到两个空字符串。
4. 阅读模式收起时左缘无条；鼠标最左缘展开文章列表；Tab 到触发区时显示焦点并打开列表；离开与选文仍按 180ms 规则收起；手机无悬停误触。
5. 打开正文链接、返回阅读、按 Escape，确认已有链接预览及焦点恢复没有回归。

- [x] **Step 4: 最终差异检查并报告**

Run: `git diff --check`

Expected: exit 0. Afterwards inspect the short working-tree status, report actual command outputs and changed files, and do not stage, commit, or overwrite the shared worktree’s unrelated changes.
