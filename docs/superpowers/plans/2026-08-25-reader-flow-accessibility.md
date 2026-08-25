# Reader Flow Accessibility Implementation Plan

> Execute in the current workspace with focused Vitest coverage before each implementation step.

**Goal:** Remove the remaining interruption points in focused reading without expanding the reader into a second navigation surface.

**Scope:** Restore predictable keyboard focus, retain article-to-article navigation in reading mode, make the active translation display visible, provide a recoverable reading-position path, and reduce mobile toolbar density. Highlighting and annotations are intentionally excluded because they require a separate persistence model.

## Tasks

### 1. Focus Contracts

- Add a focused test that leaving reading mode returns focus to its entry control.
- Preserve Contents-trigger focus only for dismissals. When a heading is selected, move focus to that heading after scrolling.
- Keep the collapsed desktop contents rail from placing every hidden text action in the tab order.

### 2. Reader Navigation and Responsive Actions

- Add previous/next article intents to `ArticleToolbar` and route them through the existing detail composable.
- Keep desktop navigation available as compact toolbar controls; place Find and Appearance in More below the mobile breakpoint.
- Surface the current original/bilingual/translation selection next to the desktop reader controls.

### 3. Resume and Shortcut Safety

- Continue using the existing local scroll-position store; announce when a saved position was restored and provide a non-destructive return-to-top action.
- Guard the reader-level Ctrl/Cmd+F handler when focus is in an editable field or when another handler has already consumed the shortcut.
- Localize the title translation loading status rather than rendering hard-coded English.

### 4. Verification

- Run focused reader tests first, then frontend unit tests and build.
- Run the project Go tests, Wails build, formatter/lint checks for touched frontend files, and `git diff --check`.
