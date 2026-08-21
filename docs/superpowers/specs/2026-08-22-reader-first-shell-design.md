# Reader-First Adaptive Shell Design

## Status

Proposed for review.

## Objective

Make MrRSS behave like a calm, capable desktop reader: navigation supports reading
instead of competing with it, every built-in theme remains coherent across the
reader shell, and narrow screens always reserve the viewport for the article list
or article content.

The reference is the interaction principle of Reeder Classic rather than a visual
copy: uncluttered Reader View, content-first hierarchy, and navigation available
when it is needed. MrRSS retains its local-first capabilities, saved filters, feed
management, and multi-pane desktop workflow.

## Current Constraints

- The existing shell has an activity rail, feed drawer, article list, and article
  reader. It already persists drawer and activity-bar preferences.
- At mobile widths the rail and feed drawer remain in the flex layout, leaving the
  article surface too narrow to be useful.
- Theme presets now set semantic root values, but reader-shell components still
  contain a few local color and hover values that do not adapt equally well.
- The implementation must preserve current HTTP APIs and settings schema. The
  existing `theme` string setting remains the sole theme preference.

## Alternatives Considered

### 1. CSS-only hiding

Hide parts of the sidebar at small breakpoints without changing the interaction
model. This is quick, but it leaves drawer state, overlays, focus handling, and
selection behavior inconsistent. It is not sufficient for a reader-first mobile
experience.

### 2. Responsive pane controller (selected)

Keep the desktop components and their data flow, but give the shell a clear
breakpoint-specific layout contract. A small composable owns whether navigation is
temporarily open on compact screens; `Sidebar`, `FeedList`, and `ArticleList` use
that state to present a real overlay drawer. Theme tokens are applied to the shell
surfaces and interaction states. This improves the current application without
rewriting feeds, filters, or article rendering.

### 3. Full navigation rewrite

Replace the rail and drawer with a new tree navigation system. This could be more
radical, but would put working drag-and-drop, saved filters, and pinning behavior at
risk. It is outside the scope of this refinement.

## Layout Contract

### Wide desktop: 1280px and above

- Keep the activity rail, feed drawer, article list, and reader visible as a
  reading workspace.
- The activity rail remains compact and icon-led. The feed drawer can still be
  pinned or temporarily hidden.
- The article list retains a controlled width so the reader receives the remaining
  space. The reading column, rather than the overall reader pane, is capped at
  68-72ch.

### Compact desktop and tablet: 768px through 1279px

- Keep the article list and reader as the primary two-pane layout.
- Treat the feed drawer as an overlay even when it was pinned on a wide display.
  The activity rail remains available as the trigger.
- The overlay has an explicit backdrop and can be closed with the close control,
  Escape, or selection. It does not reduce the reader width while closed.

### Mobile: below 768px

- The application starts with navigation closed; the article list occupies the
  viewport.
- Opening navigation shows a fixed, off-canvas reader navigation surface above the
  content, with a backdrop. It contains the activity rail and feed drawer as one
  coherent control area.
- Choosing a feed or category closes navigation and returns attention to the
  article list. Opening an article preserves the existing single-content-pane
  behavior.
- All primary touch controls are at least 44px in both dimensions.

## Theme and Surface System

Add semantic reader-shell tokens to every built-in preset:

- `--surface-rail`, `--surface-panel`, `--surface-hover`, and
  `--surface-selected`
- `--text-tertiary` for metadata that remains readable in every preset
- `--state-warning-color`, `--state-warning-background`, and a tokenized unread
  badge treatment
- `--overlay-backdrop` and a restrained `--overlay-shadow`

Use these values in the activity rail, feed drawer, feed/category selection,
article-list header, resizer, and related hover/focus states. Keep accent color for
the active location and primary controls only. Do not use a theme-specific hard
coded gray, blue, yellow, or shadow in those reader-shell surfaces.

Paper stays neutral and high-legibility, Ink remains low-light and quiet, Sepia is
restricted to reading warmth rather than decorative saturation, and High Contrast
keeps unambiguous selected, focus, and unread states.

## Navigation and List Detail

- Give all icon-only controls accessible names. The active filter is conveyed by a
  selected background and `aria-current`/pressed state, not color alone.
- Simplify rail button treatment: a consistent square target, subtle hover surface,
  explicit selected surface, and tokenized unread badge.
- Give the feed drawer a clear header, an input with an accessible label, and a
  visible focus treatment. The drawer should feel like navigation, not another
  floating card.
- Preserve right-click feed actions, drag-and-drop reorder, saved filters, and
  pinning on wide desktop. They remain discoverable through the current controls.
- On mobile, the article-list menu control is labeled and opens the navigation
  drawer. No persistent rail consumes horizontal reading space.

## Reader Typography

- Center the article title, metadata, summary, and prose inside a measured reading
  column. The prose maximum is 68-72ch at the selected content font size.
- Keep the content font, size, and line-height settings authoritative. The layout
  supplies spacing and measure, not a conflicting fixed font choice.
- Retain full-width media where useful while preventing code blocks, tables, and
  long links from forcing horizontal page overflow.
- Use semantic text and surface tokens for article metadata and reader controls.
  Existing translation, full-text, AI summary, and image behaviors are unchanged.

## Interaction and Accessibility

- Keyboard focus remains visible in every theme, including High Contrast.
- Escape closes the compact navigation overlay and returns focus to its trigger.
- Drawer transitions use transform and opacity only, honor
  `prefers-reduced-motion`, and never delay content availability.
- Relevant navigation controls receive labels, pressed/current state, and reliable
  44px touch targets. Focus does not move behind an open compact overlay.

## Component Boundaries

- A new responsive-shell composable owns viewport classification and temporary
  navigation open state. It does not own feed, filter, or article selection data.
- `App.vue` connects that state to the shell and retains current content panes.
- `Sidebar.vue` controls presentation of the rail/drawer shell, including the
  compact overlay and backdrop.
- `ActivityBar.vue` and `FeedList.vue` consume semantic surface tokens and emit
  their existing selection actions. A compact selection additionally requests the
  overlay to close.
- `ArticleList.vue` owns the compact navigation trigger and tokenized toolbar
  treatment.
- `ArticleBody.vue`/article content styles establish the measured reading column.

## Test and Verification Plan

- Unit test viewport transitions and navigation close behavior in the responsive
  shell composable.
- Extend component tests for meaningful labels, selected states, and mobile menu
  behavior where the existing test setup supports them.
- Run theme utility tests and confirm all preset root attributes and color schemes.
- Use browser verification at 1440px, 1024px, 768px, and 390px for Paper, Ink,
  Sepia, and High Contrast. Confirm that no text or controls overlap and that
  compact navigation does not shrink the primary reading surface.
- Run scoped accessibility checks for the reader shell and preset picker, then run
  the frontend unit suite, lint, formatting check, and production build.

## Acceptance Criteria

1. At 390px, closed navigation leaves the full viewport to the article list or
   article reader; opening it behaves as an overlay and can be closed accessibly.
2. At 768px and 1024px, the reader/list remain usable without a permanently
   width-consuming feed drawer.
3. At 1440px, the multi-pane reading workspace remains efficient and retains
   desktop pinning behavior.
4. Paper, Ink, Sepia, and High Contrast apply consistently to the reader shell,
   selected navigation, unread indicators, focus, and hover surfaces.
5. Article prose stays within a readable 68-72ch measure while honoring user font
   size and line-height settings.
6. Existing feed management, saved filters, drag-and-drop, article actions, and
   desktop article close behavior remain functional.

## Non-Goals

- A free-form theme editor or importable third-party theme format.
- Replacing the feed hierarchy, filter engine, article parser, or backend APIs.
- A full visual imitation of Reeder Classic or platform-specific native controls.
