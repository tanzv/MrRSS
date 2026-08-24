# Reader session continuity design

## Goal

Keep the reader as a continuous workspace while preserving its focused default
layout. Desktop readers can temporarily expose the article list from the left
edge, and links opened from rendered article content always have an explicit,
safe path back to the same reader session.

## Confirmed problems

- `App.vue` hides the desktop article-list container with `md:hidden` whenever
  reading mode is active. The list stays mounted but there is no pointer or
  keyboard target that can reveal it.
- `ArticleContent.vue` resolves article links and rewrites `_blank` to `_self`.
  It then permits native navigation. In the desktop WebView, that navigation
  replaces MrRSS's application document, so the reader has no return control.

## Interaction contract

### Reader article-list edge reveal

- On desktop reading mode only, a quiet 16px left-edge trigger is available.
  Pointer entry or keyboard focus reveals the already-mounted `ArticleList` as
  an overlay above the reader; it never reveals the feed sidebar.
- The overlay uses the existing configured article-list width and height. It
  does not resize the reader or remount the list, so its filters and scroll
  position remain intact.
- The reveal remains visible while pointer or focus stays in the combined edge
  and article-list region. It retracts after the existing short release delay
  when both leave.
- Selecting an article dismisses the transient overlay immediately. Reading
  mode remains active and the selected article continues in rendered content.
- Mobile and card-mode behavior do not change. The edge target is labeled and
  keyboard-focusable; reduced-motion preferences keep the existing transition
  behavior.

### In-reader link view

- Text links in rendered article and summary content resolve relative HTTP(S)
  URLs against the article URL. A normal activation prevents top-level WebView
  navigation and emits the resolved URL to `ArticleDetail`.
- `ArticleDetail` opens the destination in an in-app, proxied iframe layer
  above the still-mounted rendered article. Its header exposes **Back to
  reading** and Escape as explicit exits.
- Closing this layer clears only the transient link URL. The selected article,
  reader-mode flag, article DOM, and article scroll position remain unchanged.
- Image links, page-fragment anchors, and unsupported protocols keep their
  existing behavior. Link handling applies to normal rendered articles too,
  so no article content can replace the application document.

## Boundaries

- Do not make the sidebar visible from the reader edge.
- Do not add browser-history stacks, a new persisted setting, a database
  migration, or a new dependency.
- Do not change the existing explicit “open in default browser” action.
- Reuse the existing webpage proxy endpoint and iframe sandbox policy.

## Test plan

1. Replace the old regression expectation that text links allow native
   navigation with a failing component test that asserts a resolved
   `open-link` event and prevented default navigation.
2. Add `ArticleDetail` coverage that opens the link layer, closes it through
   its return action, and confirms reading mode and article content remain.
3. Add `App` coverage for desktop edge-pointer reveal, delayed retraction,
   overlay-only article-list visibility, and sidebar concealment in reading
   mode.
4. Run focused Vitest files first, then the full frontend suite, lint, Vite
   production build, and Wails build before installing a local application
   update.
