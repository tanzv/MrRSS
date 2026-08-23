# 阅读外观控制与内置风格设计

## 目标

在阅读模式中提供一个低干扰、可即时预览的 `Aa` 外观面板。读者能在不离开文章的情况下选择经过收敛的内置阅读风格，并调整字号、字体、阅读密度和桌面栏宽。

这项设计服务于 RSS 文章而不是电子书：正文区域保持焦点，侧边栏继续关闭，文章媒体、链接、翻译、摘要和阅读进度的既有行为不改变。

## 参考原则

- Reeder 的 Reader View 以去除干扰的文章阅读为中心，并允许按订阅源自动进入 Reader View。MrRSS 保持同样的“文章优先”原则，而不在阅读模式增加新的导航面板。[Reeder Classic](https://www.reeder.app/classic/)
- Readwise Reader 将字体、字号、行距和栏宽放在阅读中的 `Aa` 入口；小屏从菜单进入同一类外观设置。MrRSS 采用这一直接调节模式，但仅保留 RSS 阅读真正有意义的控制项。[Readwise Reader Appearance](https://docs.readwise.io/reader/docs/faqs/appearance)
- Apple Books 将预设主题、字体与间距微调、重置操作组合在同一阅读上下文中。MrRSS 借用“先选风格、后作微调、可恢复推荐”的心智模型，不引入分页、亮度、字符间距或两栏分页等电子书专属功能。[Apple Books Themes & Settings](https://support.apple.com/en-gb/guide/iphone/iphc1af7c57/26/ios/26)
- Reeder 5 同时提供 New York 和 Helvetica Neue 作为文章字体选择，说明衬线长读与无衬线扫描是有价值的两条排版路线；MrRSS 使用系统可用字体与通用字体族实现这一原则，不捆绑或下载第三方字体。[Reeder 5 review](https://www.macstories.net/reviews/reeder-5-review-read-later-tagging-icloud-sync-and-design-refinements/)

## 范围与边界

- 仅在已进入阅读模式且展示 RSS 正文时显示 `Aa`。
- 外观设置是全局阅读偏好，立即作用于当前文章和后续文章；不做单篇文章、单订阅源或临时会话覆盖。
- 应用主题继续决定语义颜色、对比度和表面；阅读风格只决定排版与有限的标题节奏。切换主题绝不覆盖读者已选的排版。
- 不新增后端设置字段、数据库迁移、网络依赖或字体下载。现有五项持久化设置仍是唯一来源：`content_font_family`、`content_font_size`、`content_line_height`、`content_width`、`content_paragraph_spacing`。
- 不在这一项中加入分页、屏幕亮度、字距、词距、对齐方式、双栏、朗读或高亮功能。RSS HTML 的富媒体、表格和嵌入内容不应被电子书布局规则破坏。

## 内置阅读风格

内置项必须表达实际阅读场景，不是六套颜色皮肤。颜色始终由当前应用主题提供。

| 风格 | 使用场景 | 字体 | 字号 | 行高 | 栏宽 | 段落间距 | 标题节奏 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Focus / 专注 | 默认的日常 RSS 阅读 | `system` | 16px | 1.6 | comfortable | comfortable | 标准 |
| Magazine / 杂志 | 深度报道、文化与设计文章 | `serif` | 17px | 1.7 | comfortable | comfortable | 编辑式 |
| Book / 书卷 | 长文、随笔与专题 | `serif` | 18px | 1.8 | narrow | relaxed | 标准 |
| Night / 夜读 | 弱光环境下的连续阅读 | `system` | 17px | 1.7 | comfortable | relaxed | 标准 |
| Clarity / 清晰 | 较大字级与可读性优先 | `system` | 18px | 1.8 | comfortable | relaxed | 标准 |
| Compact / 紧凑 | 快速扫描新闻与信息流 | `sans-serif` | 15px | 1.5 | wide | compact | 标准 |

`Magazine` 的五项值与其他风格完全不同，因此可继续由现有的完整值匹配判断当前风格，无需保存额外的“当前风格”字段。它会对文章标题和元数据采用轻量的编辑式节奏：衬线标题、稍大的标题比例、较清晰的标题和元数据分隔。它不伪造封面、不为无图文章生成图像、不修改文章内的媒体与颜色。

选择任一风格会写入完整的五项排版值。之后修改任意一项，该状态显示为 `Custom / 自定义`。对于 Magazine，这也意味着文章标题恢复为中性标题节奏；风格本身是一个完整预设，不是与自定义排版并存的第二份持久化状态。

## 主题关系

既有的主题推荐关系维持不变：Paper 对应 Focus、Ink 对应 Night、Sepia 对应 Book、High Contrast 对应 Clarity。Magazine 和 Compact 不与任何主题绑定。

设置页和阅读内面板都可展示当前主题推荐标记，但该标记只帮助选择，不能替代已选中状态。使用 `Auto` 或自定义主题时，继续依据已解析的有效基础主题决定推荐项。此规格取代此前“只有 Compact 无主题绑定”的表述。

## 阅读内交互

### 入口与焦点

- `ArticleToolbar` 在阅读模式下的操作分组中加入 `Aa` 图标按钮，放在阅读模式分隔线之后。非阅读模式不显示该按钮。
- 进入阅读模式时，现有文章滚动区域仍获得焦点；打开外观面板不会改变这一入口规则。
- 面板关闭时，焦点返回 `Aa` 触发按钮。按 Escape、点击桌面端面板外部或点击关闭图标均关闭面板；手机端通过关闭图标或遮罩关闭。
- `Aa` 使用可见提示和本地化的 `aria-label`、`aria-expanded`、`aria-controls`。风格选项使用 `radiogroup`，保留方向键、Home 和 End 的键盘选择行为。

### 桌面与手机布局

- 宽度至少 640px 时，`Aa` 打开定位在触发按钮附近的非模态浮层。浮层通过 Teleport 渲染在页面顶层，避免工具栏的横向滚动容器裁切它；窗口缩放或页面滚动时重新定位。
- 宽度小于 640px 时，同一内容渲染为底部模态面板，带遮罩和焦点约束。面板内容可纵向滚动，但正文栏宽控制不显示，因为手机阅读列始终为全宽。
- 两种布局都不在阅读区内堆叠卡片。面板是单一受控工具表面，控件按“风格、文字、版面、恢复”顺序排列。

### 控制项

1. 风格：六个紧凑型单选项，显示名称与一行简短阅读场景。当前主题推荐项有非颜色唯一的文字与图标标记。
2. 字号：`A-`、当前像素值、`A+` 三段稳定控制，1px 步进，范围固定为 10px 到 24px。达到边界时相应按钮禁用。
3. 字体：复用 `FontFamilySelect` 与现有字体检测能力，提供系统、衬线、无衬线、等宽及本机已检测字体。选择立即生效。
4. 阅读密度：紧凑、均衡、舒展三项分段控制，只共同修改行高和段落间距：紧凑为 `1.5`/`compact`，均衡为 `1.6`/`comfortable`，舒展为 `1.8`/`relaxed`。
5. 栏宽：仅桌面显示窄、舒适、宽三项分段控制，只修改 `content_width`。手机端不显示无效控制。
6. 恢复：提供“使用当前主题推荐风格”命令，写入该推荐项完整的五项排版值。它是恢复默认阅读节奏的明确动作，不会改变应用主题。

控制变化立即更新共享设置，使当前文章在面板保持打开时实时重排。面板在 500ms 内合并连续调整，并在关闭前刷新未落盘的请求。

## 组件与数据流

### 纯排版模型

`frontend/src/utils/readerTypography.ts` 继续是排版的唯一纯函数边界：

- `ReaderTypographyPresetId` 与 `readerTypographyPresets` 增加 `magazine`。
- `getReaderTypographyPreset` 仍以五项完整匹配返回风格 ID 或 `custom`。
- `readerThemePresetMap` 不增加 Magazine 映射；类型、归一化、CSS 变量和既有主题推荐 API 保持单一来源。

### 可复用的风格选择器

现有 `ReaderTypographyPresetPicker` 的选项构造、选择状态、推荐标记与键盘逻辑抽取为可复用的小边界。设置页继续使用完整的两列说明版；阅读内面板使用紧凑版。两个位置必须使用同一份预设数组和同一套完整值，避免标签或选择行为漂移。

### 阅读内面板与持久化

- 新的 `ReaderAppearancePanel` 只负责呈现桌面浮层或手机底部面板，接收当前 `SettingsData`，并对外发出完整风格值或局部排版更新。
- 新的 `useReaderTypographyPreferences` 负责更新共享 `useSettings()` 引用、合并 500ms 保存、关闭时刷新、构建既有 `/api/settings` 请求体，并在成功时发送 `settings-updated` 的 autosave 事件。
- 此组合式函数应由始终挂载的阅读工具栏拥有，而不是由条件渲染的面板拥有，确保用户在 500ms 内关闭面板时改动不会被销毁时取消。
- 保存失败时当前页面继续保留实时预览，向用户显示本地化失败提示，并在面板底部显示带可读名称的重试图标按钮；下一次排版调整也会自动重试最新值。不得静默回退到旧字体或旧字号。

### 文章样式应用

`ArticleContent` 根据当前排版模型计算只读 `readerStyle`，为阅读列与 `ArticleTitle` 提供该值。`ArticleTitle` 仅在 `readerStyle === 'magazine'` 时应用编辑式标题节奏。正文仍完全由现有 reader CSS 变量排版，媒体仍遵循已有安全、响应式样式。

## 国际化与可访问性

- 为中英文补齐 Magazine、外观面板、密度、栏宽、恢复命令、保存错误、字号边界和弹层标签。
- 所有图标按钮都有 `title` 与可读名称；`A-`/`A+` 有明确的减小或增大字号名称，不能只依赖视觉字母。
- 读者可用 Tab 逐项操作，风格组支持单选组键盘规则。桌面浮层不可拦截正文的常规滚动；手机面板以 `role="dialog"` 和 `aria-modal="true"` 管理焦点。
- 主题推荐、风格选中和错误状态均不能只依赖颜色。所有窄屏文本必须允许换行，面板不能产生横向滚动。

## 测试与验收

- `readerTypography` 单元测试覆盖 Magazine 的完整五项值、识别结果、主题推荐不包含 Magazine，以及未知输入回退。
- 风格选择器测试六项渲染、Custom 状态、主题推荐标记和键盘导航；设置页与阅读内版本使用相同的值。
- `useReaderTypographyPreferences` 测试即时共享状态、500ms 合并保存、关闭刷新、API 失败提示和后续重试。
- `ReaderAppearancePanel` 与 `ArticleToolbar` 组件测试阅读模式入口、非阅读模式隐藏、桌面 Escape/外部关闭、手机模态行为、焦点返回、字号边界和手机隐藏栏宽。
- `ArticleContent` 与 `ArticleTitle` 测试 Magazine 的数据属性和标题节奏，以及任意手动调整后回到 Custom 与中性标题节奏。
- 浏览器验收覆盖桌面和手机：进入阅读模式后焦点在文章区域；打开 `Aa` 后实时变更字体、字号、密度和栏宽；关闭后焦点正确返回；Paper、Ink、Sepia、High Contrast 下颜色仍由主题决定；无横向溢出。
- 完整交付前运行前端单元测试、前端生产构建、Go 测试与 `wails3 build`，并在本地 macOS 应用中检查阅读模式实际行为。
