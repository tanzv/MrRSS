# Sidebar Control Placement and Unread Count Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Keep desktop auto-hide actions inside the activity bar and make feed-row unread counts informative without visually dominating the sidebar.

**Architecture:** Sidebar.vue owns the persisted auto-hide preference and uses the far-left 16px region only for transient mouse preview. ActivityBar.vue owns the sole desktop visibility action at the bottom of the visible rail. SidebarFeed.vue keeps feed-level unread data but presents it as muted text rather than a filled badge.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, vue-i18n, Phosphor Icons, Vitest, Cypress, Vite.

## Global Constraints

- Preserve ActivityBarCollapsed: true means desktop auto-hide.
- Desktop left edge is a 16px visual-free reveal area; its invisible focus target may reveal the bar for keyboard users, but it has no visible pin, collapse, or expand button.
- Temporary preview overlays the feed drawer and never changes its left position or reader width.
- The only desktop visibility action is at the bottom of the visible activity bar: Auto-hide Activity Bar while fixed and Keep Activity Bar Visible while previewed.
- Keep existing 44px mobile Collapse/Expand controls and their aria-expanded behavior.
- Keep unread counts on feeds and absent from group headers; do not change count data or filtering behavior.
- Feed unread counts use existing semantic text tokens; do not add theme settings or remove global unread-badge tokens used elsewhere.
- Do not stage unrelated user changes.

---

### Task 1: Move the desktop visibility action into ActivityBar

**Files:**
- Modify: frontend/src/components/sidebar/ActivityBar.vue
- Modify: frontend/src/components/sidebar/Sidebar.vue
- Test: frontend/src/components/sidebar/SidebarNavigation.test.ts

**Interfaces:**
- ActivityBarVisibilityControl becomes 'auto-hide' | 'pin' | 'collapse'.
- ActivityBar emits hide-activity-bar for auto-hide and collapse, and pin-activity-bar for pin.
- Sidebar passes auto-hide while fixed, pin during desktop preview, and collapse on mobile.

- [ ] **Step 1: Write a failing component contract test**

~~~
const previewWrapper = mount(ActivityBar, {
  props: { visibilityControl: 'pin' },
  global: { plugins: [createPinia(), i18n] },
});

const pinControl = previewWrapper.get('button[aria-label="Keep Activity Bar Visible"]');
await pinControl.trigger('click');
expect(previewWrapper.emitted('pin-activity-bar')).toHaveLength(1);
expect(previewWrapper.find('button[aria-label="Auto-hide Activity Bar"]').exists()).toBe(false);
~~~

Also assert Sidebar binds @pin-activity-bar="pinActivityBar".

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts

Expected: pin visibility mode and pin-activity-bar event do not exist.

- [ ] **Step 3: Implement the bottom action**

~~~
type ActivityBarVisibilityControl = 'auto-hide' | 'pin' | 'collapse';

const visibilityControlLabel = computed(() => {
  if (props.visibilityControl === 'auto-hide') {
    return t('sidebar.activity.autoHideActivityBar');
  }
  if (props.visibilityControl === 'pin') {
    return t('sidebar.activity.pinActivityBar');
  }
  return t('sidebar.activity.collapseActivityBar');
});
~~~

Render PhPushPinSlash for auto-hide, PhPushPin for pin, and PhTextOutdent for collapse. Emit pin-activity-bar only for pin. Implement the persistence action:

~~~
function pinActivityBar(): void {
  dismissTemporaryReveal();
  isActivityBarAutoHideEnabled.value = false;
  saveActivityBarAutoHideState();
}
~~~

Keep the mobile edge handler separate because its button is removed after
expansion and keyboard focus must move into the rail:

~~~
function expandMobileActivityBar(event: MouseEvent): void {
  const shouldRestoreKeyboardFocus = event.detail === 0;
  pinActivityBar();
  if (shouldRestoreKeyboardFocus) {
    nextTick(() => {
      sidebarToggleContainerRef.value
        ?.querySelector<HTMLElement>('.smart-activity-bar button')
        ?.focus();
    });
  }
}
~~~

- [ ] **Step 4: Run focused tests**

Run: npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts src/composables/ui/useSidebarEdgeReveal.test.ts

Expected: all visibility and transient lifecycle tests pass.

- [ ] **Step 5: Commit**

~~~
git add frontend/src/components/sidebar/ActivityBar.vue frontend/src/components/sidebar/Sidebar.vue
git commit -m "feat(sidebar): keep visibility controls in activity bar"
~~~

### Task 2: Make the desktop edge a visual-free reveal zone

**Files:**
- Modify: frontend/src/components/sidebar/Sidebar.vue
- Modify: frontend/cypress/e2e/theme-sidebar.cy.ts
- Modify: frontend/src/i18n/locales/en.ts
- Modify: frontend/src/i18n/locales/zh.ts
- Test: frontend/src/components/sidebar/SidebarNavigation.test.ts

**Interfaces:**
- sidebar-reveal-bridge becomes the combined desktop pointer and focus region.
- data-testid="sidebar-edge-toggle" is rendered only on mobile.
- The desktop preview exposes its pin action in ActivityBar.

- [ ] **Step 1: Write failing desktop and mobile browser assertions**

At desktop startup with ActivityBarCollapsed=true:

~~~
cy.get('[data-testid="sidebar-edge-toggle"]').should('not.exist');
cy.get('.sidebar-toggle-container').trigger('pointerenter', { pointerType: 'mouse' });
cy.get('button[aria-label="Keep Activity Bar Visible"]').click();
cy.window().its('localStorage.ActivityBarCollapsed').should('equal', 'false');
~~~

Retain the mobile check for the 44px Expand Activity Bar edge control and aria-expanded="false".
Add a desktop keyboard assertion that focusing and activating the invisible
reveal trigger moves focus to the first activity-bar button.

- [ ] **Step 2: Run focused browser coverage**

Run: npm run test:e2e:spec -- cypress/e2e/theme-sidebar.cy.ts

Expected: it fails against the old desktop pin tab, or reports the known unavailable Cypress application binary without downloading it.

- [ ] **Step 3: Remove the desktop pin tab**

~~~
<button
  v-if="!props.isMobile && isActivityBarAutoHideEnabled"
  type="button"
  class="sidebar-reveal-bridge"
  :aria-label="t('sidebar.activity.showActivityBar')"
  @click="focusDesktopPreview"
></button>

<button
  v-if="props.isMobile && isActivityBarAutoHideEnabled"
  type="button"
  data-testid="sidebar-edge-toggle"
  class="edge-pin-button"
  :title="t('sidebar.activity.expandActivityBar')"
  :aria-label="t('sidebar.activity.expandActivityBar')"
  :aria-expanded="isActivityBarVisible"
  @click="expandMobileActivityBar"
>
  <PhCaretRight :size="20" weight="regular" />
</button>
~~~

Implement focusDesktopPreview() with nextTick so activation moves focus to the
first .smart-activity-bar button. Keep sidebar-reveal-bridge visually
transparent until focus-visible. Remove desktop edge-pin styles and imports,
but retain the mobile 44px rule. Add showActivityBar translations: Show
Activity Bar / 显示活动栏.

- [ ] **Step 4: Run the installed browser probe**

At 1440px with a pinned drawer, verify: no desktop edge action, drawer left remains 16px through preview, pointer movement from x=4 to x=36 keeps preview open, and the bottom pin action persists fixed-visible mode.

- [ ] **Step 5: Commit**

~~~
git add frontend/src/components/sidebar/Sidebar.vue frontend/src/components/sidebar/SidebarNavigation.test.ts frontend/cypress/e2e/theme-sidebar.cy.ts
git commit -m "fix(sidebar): keep desktop edge as a reveal zone"
~~~

### Task 3: De-emphasize feed-row unread numbers

**Files:**
- Modify: frontend/src/components/sidebar/SidebarFeed.vue
- Test: frontend/src/components/sidebar/SidebarNavigation.test.ts

**Interfaces:**
- SidebarFeed keeps span v-if="unreadCount > 0" class="unread-badge" and its numeric content.
- unread-badge uses --text-tertiary as text-only presentation; hover, focus, and active rows may inherit currentColor.

- [ ] **Step 1: Write a failing presentation test**

~~~
expect(sidebarFeedSource).toMatch(
  /\.unread-badge\s*\{[\s\S]*?color:\s*var\(--text-tertiary\);[\s\S]*?font-variant-numeric:\s*tabular-nums;/
);
expect(sidebarFeedSource).not.toMatch(
  /\.unread-badge\s*\{[\s\S]*?background-color:\s*var\(--unread-badge-background\);/
);
~~~

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts

Expected: unread-badge still uses a filled unread-badge background.

- [ ] **Step 3: Implement muted numeric styling**

~~~
.unread-badge {
  margin-left: 0.25rem;
  color: var(--text-tertiary);
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
  opacity: 0.78;
  font-variant-numeric: tabular-nums;
}

.feed-item:hover .unread-badge,
.feed-item:focus-visible .unread-badge,
.feed-item.active .unread-badge {
  color: currentColor;
  opacity: 0.9;
}
~~~

Do not change group-header behavior or global unread-badge theme tokens.

- [ ] **Step 4: Run focused tests and formatting**

Run: npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts

Run: npx prettier --check src/components/sidebar/SidebarFeed.vue src/components/sidebar/SidebarNavigation.test.ts

Expected: tests and formatting pass.

- [ ] **Step 5: Commit**

~~~
git add frontend/src/components/sidebar/SidebarFeed.vue frontend/src/components/sidebar/SidebarNavigation.test.ts
git commit -m "style(sidebar): soften feed unread counts"
~~~

### Task 4: Final verification and documentation

**Files:**
- Modify: docs/superpowers/specs/2026-08-24-sidebar-auto-hide-controls-design.md
- Modify: docs/superpowers/plans/2026-08-24-sidebar-auto-hide-controls.md

- [ ] **Step 1: Run complete verification**

~~~
cd frontend
npm run test:unit
npx eslint src
npx eslint --no-ignore cypress/e2e/theme-sidebar.cy.ts
npx prettier --check src cypress/e2e/theme-sidebar.cy.ts
npm run build
cd ..
git diff --check
wails3 build
~~~

Expected: all commands exit 0. Record only pre-existing jsdom canvas, Vite configuration, bundle-size, and platform linker warnings.

- [ ] **Step 2: Re-run browser probes**

At desktop and mobile viewports, verify labels, persistence, drawer geometry, pointer movement into the preview rail, bottom pin action, mobile Collapse → Expand, and muted unread-count appearance.

- [ ] **Step 3: Commit documentation**

~~~
git add docs/superpowers/specs/2026-08-24-sidebar-auto-hide-controls-design.md docs/superpowers/plans/2026-08-24-sidebar-auto-hide-controls.md
git commit -m "docs(sidebar): refine auto-hide control design"
~~~
