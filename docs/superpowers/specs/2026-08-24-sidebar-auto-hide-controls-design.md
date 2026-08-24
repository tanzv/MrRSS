# Sidebar auto-hide controls design

## Goal

Resolve the ambiguity between a user-persisted sidebar preference and a
mouse-only edge preview, while reducing visual noise in subscription rows. The
desktop activity bar has two intentional modes: **fixed visible** and
**auto-hide**. A hover is never described as an expand or collapse action.

## State model

`ActivityBarCollapsed` remains the storage key for backward compatibility.
Its `true` value is now named `isActivityBarAutoHideEnabled` in code and means
that the activity bar is auto-hidden. No storage migration is required.

`isTemporarilyRevealed` remains transient. It can only be true while auto-hide
is enabled on a non-mobile layout. It never writes local storage and only
controls visual availability of the rail.

| Persisted mode | Temporary reveal | Visible UI | User action |
| --- | --- | --- | --- |
| Fixed visible | No | 48px activity bar | Bottom control enables auto-hide. |
| Auto-hide | No | 16px left-edge reveal zone, with no visible button | Moving to the edge previews the bar. |
| Auto-hide | Yes | Activity bar overlaid above its unchanged feed drawer | Bottom control fixes the bar open; leaving the region retracts otherwise. |

## Button design

- The final button in the visible activity bar is the only desktop visibility
  control. In fixed-visible mode it uses an unpin icon and the label
  **Auto-hide Activity Bar** / **自动隐藏活动栏**.
- When an auto-hidden bar is temporarily revealed, that same bottom position
  uses a pin icon and **Keep Activity Bar Visible** / **固定活动栏**. It exits
  auto-hide mode without moving the pointer to a separate left-side button.
- The far-left 16px region is only a mouse reveal affordance. It has no
  permanently displayed icon, label, or collapse action.
- The desktop bottom control has no `aria-expanded`: it changes a persistence
  preference rather than a disclosure state. Its label describes the resulting
  user action directly.
- On mobile there is no hover preview, so the existing explicit
  **Collapse Activity Bar** / **Expand Activity Bar** pair remains in place
  with disclosure state. This keeps the 44px off-canvas navigation behavior
  intact instead of applying desktop auto-hide wording to touch input.

## Subscription unread counts

- Keep counts on individual subscription rows and keep them absent from group
  headers.
- Render a count as a compact, tabular-figure text value rather than a filled
  circular badge: no background, border, fixed pill width, or high-contrast
  foreground.
- Default to the semantic tertiary text token with reduced opacity. The count
  may inherit the row color on hover, keyboard focus, or active selection, so
  it remains legible without dominating the scan path.

## Layout, input, and accessibility

- Desktop hover reveals the activity bar; moving within the combined edge and
  activity-bar region keeps it visible. Touch and mobile layouts retain the
  existing explicit off-canvas navigation and 44px controls.
- Temporary reveal overlays the feed drawer without changing drawer placement
  or reader width. Selecting **Keep Activity Bar Visible** is an intentional
  persistent mode change and restores normal 48px rail geometry.
- Standard activity-bar controls remain 44px square. The left edge remains
  visually quiet because it contains no persistent control.
- Existing reduced-motion handling remains in effect. Labels are localized in
  English and Simplified Chinese.

## Verification

- Rename focused composable test inputs to the auto-hide terminology while
  retaining pointer, focus, timing, mobile, and persistence-boundary coverage.
- Add source/component assertions that ensure the auto-hide and pin controls
  occupy the activity-bar bottom position, have accurate labels, and do not
  use disclosure `aria-expanded` on desktop.
- Update the desktop Cypress journey to distinguish a transient preview from
  a persisted fixed-visible action, while retaining drawer-position and mobile
  target checks.
- Add component assertions for unobtrusive subscription-row unread numbers and
  their hover, focus, and active-state treatment.
