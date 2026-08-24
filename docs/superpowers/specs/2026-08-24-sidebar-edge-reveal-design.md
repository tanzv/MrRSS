# Sidebar edge reveal design

## Goal

Make the desktop reader navigation recede when it is collapsed without making it
hard to rediscover. Moving the pointer to the far-left edge temporarily reveals
the activity toolbar; leaving it returns the toolbar to its collapsed state.

## Scope

- Desktop and pointer-capable compact layouts only.
- Reveal the activity toolbar only; do not automatically expand the feed drawer.
- Keep a persistent edge control that can be clicked to restore the existing,
  saved expanded state.
- Preserve the current mobile off-canvas navigation and its 44px touch targets.

## Interaction model

The persistent `isActivityBarCollapsed` state remains the source of truth for a
user-pinned collapse preference. A separate, transient edge-reveal state must
never write to local storage.

When the rail is persistently collapsed on a non-mobile layout:

1. A full-height left-edge control remains visible as a subdued visual gutter.
2. Pointer entry or keyboard focus opens a temporary 48px activity toolbar.
3. Pointer or focus leaving the combined edge-and-toolbar region closes it after
   a short grace period, preventing accidental closure while moving into a tool.
4. Clicking the edge control uses the existing toggle and persists the expanded
   state. The toolbar's existing collapse control continues to persist collapse.
5. If a feed drawer is open, the temporary toolbar layers above its left edge;
   neither the drawer nor the article layout is moved or automatically opened.

On touch/mobile layouts, edge hover behavior is disabled. The existing 44px
edge control remains the discoverable and accessible way to expand the rail.

## Visual direction

Treat the collapsed rail as a quiet reading gutter rather than a second primary
column:

- Use a 48px desktop rail, which keeps 44px controls intact while reducing its
  width from the current wide desktop presentation.
- Keep the edge gutter and its caret low contrast at rest; increase contrast
  only on hover, focus, or the temporary reveal state.
- Reduce persistent chrome by making dividers and the logo less visually heavy.
- Keep selected navigation, focus rings, unread badges, and semantic theme
  tokens fully legible. Never apply whole-rail opacity because that would weaken
  contrast for text and badges.
- Animate only opacity and transform, and respect `prefers-reduced-motion`.

## Accessibility and resilience

- The edge control remains a real labelled button and can receive keyboard
  focus.
- Focus within the temporary rail holds it open, so keyboard users can reach
  every activity action without a hover dependency.
- Focus leaving the rail restores the collapsed appearance unless the user has
  explicitly clicked to persist expansion.
- Existing activity-bar labels, selected-page semantics, and visible focus
  outlines remain unchanged.

## Verification

Add focused unit tests for the persistent-versus-transient state boundary,
pointer/focus reveal, pointer/focus leave auto-collapse, and explicit click
expansion. Extend sidebar source/component assertions for the 48px desktop rail
and mobile 44px behavior. Extend the Cypress theme-sidebar flow with a desktop
edge-reveal check and retain existing theme and mobile-target coverage.

Run focused sidebar tests, frontend lint/format checks, the production build,
and the available end-to-end test command. Report any unavailable browser binary
or desktop build tool separately.

## Out of scope

- Changing feed-drawer pinning or persistence behavior.
- Changing the sidebar's information architecture.
- Adding a new user setting for edge reveal.
