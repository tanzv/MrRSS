# 主题对应阅读风格设计

## 目标

让阅读设置提供一组清晰的内置阅读风格，并让读者能直接看出它们与应用主题的关系。应用主题继续控制阅读器的颜色和对比度；阅读风格只控制正文的字体、字号、行高、栏宽和段落节奏。

## 已确认的产品决策

- Paper、Ink、Sepia 和 High Contrast 主题分别有一组推荐的阅读排版。
- 切换应用主题始终立即更新阅读器的语义颜色，但绝不自动覆写读者已经选择或调整的正文排版。
- 当前主题对应的推荐风格在阅读设置中以可见主题色样和无障碍标签标记；读者必须显式选择该风格才会写入排版设置。
- 读者手动调整任一排版字段后，风格选择器显示“自定义”。不新增隐藏的“当前阅读风格”持久化字段。
- 现有 `content_font_family`、`content_font_size`、`content_line_height`、`content_width` 和 `content_paragraph_spacing` 是正文排版的唯一持久化来源。
- Compact 是独立的高密度风格，不与任何应用主题绑定。
- `Auto` 主题依据已经解析的有效主题显示推荐项：系统浅色时对应 Paper，系统深色时对应 Ink。
- 自定义主题将继续通过其解析后的基础主题获得推荐风格；本次不修改自定义主题档案、主题 token 或全局主题设置。

## 风格映射

| 应用主题 | 阅读风格 | 字体 | 字号 | 行高 | 栏宽 | 段落间距 |
| --- | --- | --- | --- | --- | --- | --- |
| Paper | Focus | system | 16px | 1.6 | comfortable | comfortable |
| Ink | Night | system | 17px | 1.7 | comfortable | relaxed |
| Sepia | Book | serif | 18px | 1.8 | narrow | relaxed |
| High Contrast | Clarity | system | 18px | 1.8 | comfortable | relaxed |
| 无绑定 | Compact | sans-serif | 15px | 1.5 | wide | compact |

Focus、Night、Book 和 Clarity 的选项会显示其关联主题名和三段色样。Compact 使用中性密度标记，不假装对应一个主题。

## 交互与数据流

`readerTypography.ts` 继续是排版值的唯一纯函数边界。它新增主题到预设的只读映射和获取推荐预设的函数，不读取 DOM、不写设置，也不应用颜色。

`TypographySettings` 从 Pinia 的已解析主题状态取得当前有效主题，并将它传给 `ReaderTypographyPresetPicker`。选择器基于该值给推荐的卡片增加状态标记，并在无障碍名称中描述其主题对应关系。选择任一风格仍只发出完整的五项排版值；设置页沿用既有自动保存路径。

阅读器正文、工具栏、续读入口和预览继续使用全局语义 CSS 变量，因此 Paper、Ink、Sepia、High Contrast 以及未来自定义主题的颜色会自动一致。为便于测试和诊断，阅读正文列和排版预览暴露当前解析主题的只读 `data-reader-theme` 属性；该属性不参与样式状态和持久化。

## 边界与可访问性

- 未知主题值回退为 Focus 推荐，不影响已有的排版值。
- 选项的主题关联不以颜色为唯一提示：可见主题名称、`aria-label` 和推荐状态一起表达。
- 主题推荐标记不会替代选中状态；只有完整五项值匹配时才显示已选中。
- 阅读模式在小屏仍使用全宽正文；主题色样、预设按钮和预览不得造成横向滚动。
- 不新增网络请求、第三方依赖或数据库迁移。

## 测试与验收

- 纯 TypeScript 测试覆盖四个主题到预设的映射、未知主题回退，以及 Night、Clarity 的完整五项排版值。
- 选择器组件测试五个选项、当前主题推荐标记、主题关联的无障碍名称和选择 Night/Clarity 时发出的完整值。
- 阅读设置组件测试把当前解析主题传入选择器，并保持单项手动调整后的 Custom 状态。
- 阅读正文和预览组件测试 `data-reader-theme` 反映当前有效主题，且 CSS 仍由现有语义变量提供颜色。
- 浏览器验收在 Paper、Ink、Sepia、High Contrast 下检查阅读器表面、正文、预设推荐状态和移动端无横向溢出；确认切换主题不会改写已手动选择的排版值。
