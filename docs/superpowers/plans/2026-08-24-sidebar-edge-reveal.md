# Sidebar Edge Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Let a persistently collapsed desktop activity rail temporarily reveal from the far-left edge, then quietly retract without changing the feed drawer or reader layout.

**Architecture:** A focused useSidebarEdgeReveal composable owns only transient reveal state, pointer/focus entry, delayed release, and cleanup. Sidebar.vue retains the persisted ActivityBarCollapsed preference and decides whether a reveal is temporary or user-persisted. ActivityBar.vue supplies the more restrained 48px visual treatment while preserving its current controls, theme tokens, and 44px interactive targets.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Tailwind CSS, Vitest, Vue Test Utils, Cypress, Vite.

## Global Constraints

- Preserve ActivityBarCollapsed, feed drawer pin/expanded persistence, filters, drag-and-drop, and all existing activity-bar events.
- Desktop and pointer-capable layouts get edge reveal; mobile remains an explicit 44px off-canvas navigation experience and never depends on hover.
- Reveal only the activity rail; do not change feed drawer expansion, positioning persistence, or reader/article width.
- Use existing semantic theme tokens; do not add hard-coded theme colors or new settings-schema fields.
- Maintain visible focus, labelled button semantics, selected-page semantics, and 44px primary touch targets.
- Animate transform and opacity only; honor prefers-reduced-motion.
- Preserve unrelated dirty worktree changes and stage only files listed in each task.

## File Map

- Create frontend/src/composables/ui/useSidebarEdgeReveal.ts: transient edge-reveal lifecycle and delayed release logic.
- Create frontend/src/composables/ui/useSidebarEdgeReveal.test.ts: pointer, focus, persistence-boundary, mobile suppression, and cleanup coverage.
- Modify frontend/src/components/sidebar/Sidebar.vue: connect the composable to the edge-and-rail region, preserve explicit expansion, and layer temporary rail above an open drawer.
- Modify frontend/src/components/sidebar/SidebarNavigation.test.ts: edge behavior, desktop geometry, and mobile invariants.
- Modify frontend/src/components/sidebar/ActivityBar.vue: quiet 48px desktop rail visual treatment while retaining accessible 44px controls.
- Modify frontend/cypress/e2e/theme-sidebar.cy.ts: desktop edge-reveal and non-disruptive drawer verification.

### Task 1: Add Transient Edge-Reveal State

**Files:**
- Create: frontend/src/composables/ui/useSidebarEdgeReveal.ts
- Test: frontend/src/composables/ui/useSidebarEdgeReveal.test.ts

**Interfaces:**
- Consumes isPersistentlyCollapsed: Readonly<Ref<boolean>> and isMobile: Readonly<Ref<boolean>>.
- Produces isTemporarilyRevealed: Readonly<Ref<boolean>>, isActivityBarVisible: ComputedRef<boolean>, handlePointerEnter(event: PointerEvent), handlePointerLeave(), handleFocusIn(), handleFocusOut(event: FocusEvent), dismissTemporaryReveal(), and dispose().

- [ ] **Step 1: Write the failing lifecycle tests**

    it('temporarily reveals only while a collapsed desktop rail is entered with a mouse', () => {
      const collapsed = ref(true);
      const mobile = ref(false);
      const state = useSidebarEdgeReveal({
        isPersistentlyCollapsed: collapsed,
        isMobile: mobile,
      });

      state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));

      expect(state.isTemporarilyRevealed.value).toBe(true);
      expect(state.isActivityBarVisible.value).toBe(true);
      expect(collapsed.value).toBe(true);
    });

    it('keeps the rail open while focus stays in its region and retracts after release', () => {
      vi.useFakeTimers();
      const region = document.createElement('div');
      const first = document.createElement('button');
      const second = document.createElement('button');
      region.append(first, second);
      const state = useSidebarEdgeReveal({
        isPersistentlyCollapsed: ref(true),
        isMobile: ref(false),
      });

      state.handleFocusIn();
      state.handleFocusOut(new FocusEvent('focusout', { relatedTarget: second }));
      expect(state.isTemporarilyRevealed.value).toBe(true);
      state.handleFocusOut(new FocusEvent('focusout', { relatedTarget: document.body }));
      vi.advanceTimersByTime(180);
      expect(state.isTemporarilyRevealed.value).toBe(false);
    });

- [ ] **Step 2: Run the focused test and verify it fails**

Run: npm run test:unit -- src/composables/ui/useSidebarEdgeReveal.test.ts

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement the focused composable**

    export function useSidebarEdgeReveal({
      isPersistentlyCollapsed,
      isMobile,
    }: UseSidebarEdgeRevealOptions) {
      const isTemporarilyRevealed = ref(false);
      const isActivityBarVisible = computed(
        () => !isPersistentlyCollapsed.value || isTemporarilyRevealed.value
      );

      function handlePointerEnter(event: PointerEvent): void {
        if (event.pointerType === 'touch' || isMobile.value || !isPersistentlyCollapsed.value) {
          return;
        }
        clearReleaseTimer();
        isTemporarilyRevealed.value = true;
      }

      function handlePointerLeave(): void {
        scheduleRelease();
      }

      return { isTemporarilyRevealed, isActivityBarVisible, handlePointerEnter, handlePointerLeave };
    }

Use a 180ms release timer. handleFocusOut must inspect currentTarget and relatedTarget so focus moves between descendants do not release the rail. Watching either mobile mode or a persisted expansion must cancel the timer and clear only transient state. dispose() and onBeforeUnmount must clear the timer.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: npm run test:unit -- src/composables/ui/useSidebarEdgeReveal.test.ts

Expected: all pointer, focus, touch suppression, persistence-boundary, and timer-cleanup tests pass.

- [ ] **Step 5: Commit only Task 1 files**

    git add frontend/src/composables/ui/useSidebarEdgeReveal.ts frontend/src/composables/ui/useSidebarEdgeReveal.test.ts
    git commit -m "feat(sidebar): add edge reveal state"

### Task 2: Connect the Collapsed Rail Without Moving Content

**Files:**
- Modify: frontend/src/components/sidebar/Sidebar.vue
- Test: frontend/src/components/sidebar/SidebarNavigation.test.ts

**Interfaces:**
- Sidebar keeps isActivityBarCollapsed: Ref<boolean> as the only local-storage-backed state.
- ActivityBar receives is-collapsed="!isActivityBarVisible"; no ActivityBar public API changes.
- The edge button calls persistExpandedFromEdge(), while the ActivityBar collapse command calls handleActivityBarToggle().

- [ ] **Step 1: Add failing Sidebar assertions**

    it('keeps temporary edge reveal separate from the persisted collapse preference', () => {
      expect(sidebarSource).toContain('useSidebarEdgeReveal');
      expect(sidebarSource).toContain(':is-collapsed="!isActivityBarVisible"');
      expect(sidebarSource).toContain('@pointerenter="handlePointerEnter"');
      expect(sidebarSource).toContain('@pointerleave="handlePointerLeave"');
    });

    it('keeps the temporary rail above an open feed drawer without changing drawer placement', () => {
      expect(sidebarSource).toMatch(
        /\.is-edge-revealed \.sidebar-toggle-container\s*\{[\s\S]*?z-index:\s*32;/
      );
      expect(sidebarSource).toContain("{ 'activity-bar-collapsed': isActivityBarCollapsed }");
    });

- [ ] **Step 2: Run the focused sidebar test and verify it fails**

Run: npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts

Expected: FAIL because the edge-reveal contract is absent.

- [ ] **Step 3: Integrate the composable in Sidebar.vue**

Import computed and toRef, create isActivityBarVisible from useSidebarEdgeReveal with isActivityBarCollapsed and toRef(props, 'isMobile'), and attach pointer/focus handlers to sidebar-toggle-container, not the outer sidebar. This bounds temporary reveal to the edge plus activity rail and prevents the feed drawer from holding it open.

Add aria-expanded and data-testid="sidebar-edge-toggle" to the edge button. Its click handler clears temporary reveal and persists expansion. When the ActivityBar collapse command fires during a temporary reveal, dismiss the transient reveal; when it fires from a persisted expanded rail, retain the current local-storage collapse behavior.

- [ ] **Step 4: Add non-disruptive positioning and reduced-motion CSS**

Use a 16px desktop edge gutter, a 48px temporary rail, and existing mobile 44px overrides. Keep feed-drawer-wrapper.activity-bar-collapsed positioned from the edge gutter so temporary reveal overlays rather than pushes it. Give compact-sidebar-wrapper.is-edge-revealed sidebar-toggle-container z-index 32; do not change feed drawer left values while temporary reveal is true. Add opacity/transform transition for temporary appearance and include it in the existing reduced-motion rule.

- [ ] **Step 5: Run focused tests and inspect the staged diff**

Run: npm run test:unit -- src/composables/ui/useSidebarEdgeReveal.test.ts src/components/sidebar/SidebarNavigation.test.ts

Run: git diff --check

Expected: all focused tests pass and no whitespace errors are reported.

- [ ] **Step 6: Commit only Task 2 files**

    git add frontend/src/components/sidebar/Sidebar.vue frontend/src/components/sidebar/SidebarNavigation.test.ts
    git commit -m "feat(sidebar): reveal collapsed rail from edge"

### Task 3: Reduce Persistent Sidebar Visual Weight

**Files:**
- Modify: frontend/src/components/sidebar/ActivityBar.vue
- Test: frontend/src/components/sidebar/SidebarNavigation.test.ts

**Interfaces:**
- Existing activity labels, filter selection, ready, drawer toggle, add-feed, settings, and collapse events remain unchanged.
- Desktop smart-activity-bar is 48px wide; each activity-nav-button remains 44px square.

- [ ] **Step 1: Add failing visual-contract assertions**

    it('uses a restrained 48px desktop rail without shrinking activity targets', () => {
      expect(activityBarSource).toMatch(
        /\.smart-activity-bar\s*\{[\s\S]*?width:\s*48px;/
      );
      expect(activityBarSource).toMatch(
        /\.activity-nav-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
      );
      expect(activityBarSource).toContain('activity-brand-mark');
      expect(activityBarSource).toContain('activity-divider');
    });

- [ ] **Step 2: Run the focused sidebar test and verify it fails**

Run: npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts

Expected: FAIL because the rail is still 56px and lacks restrained visual hooks.

- [ ] **Step 3: Apply the restrained visual treatment**

Set desktop rail width/min-width to 48px and preserve 44px button geometry. Replace bare logo and divider utility-only markup with activity-brand-mark and activity-divider classes. Use semantic theme tokens for their lower resting emphasis and restore visual emphasis only through existing hover, focus-within, and active states. Keep selected colors, unread badge colors, and the 2px focus outline unchanged.

- [ ] **Step 4: Run focused tests, lint, and format checks**

Run: npm run test:unit -- src/components/sidebar/SidebarNavigation.test.ts

Run: npx eslint src/components/sidebar/ActivityBar.vue src/components/sidebar/Sidebar.vue src/composables/ui/useSidebarEdgeReveal.ts

Run: npx prettier --check src/components/sidebar/ActivityBar.vue src/components/sidebar/Sidebar.vue src/components/sidebar/SidebarNavigation.test.ts src/composables/ui/useSidebarEdgeReveal.ts src/composables/ui/useSidebarEdgeReveal.test.ts

Expected: all commands exit 0.

- [ ] **Step 5: Commit only Task 3 files**

    git add frontend/src/components/sidebar/ActivityBar.vue frontend/src/components/sidebar/SidebarNavigation.test.ts
    git commit -m "style(sidebar): reduce rail visual weight"

### Task 4: Verify Browser Behavior Across Themes and Viewports

**Files:**
- Modify: frontend/cypress/e2e/theme-sidebar.cy.ts

**Interfaces:**
- Existing API stubs and all current preset/mobile target assertions remain intact.
- New Cypress assertions use data-testid="sidebar-edge-toggle", smart-activity-bar, and reader-feed-drawer.

- [ ] **Step 1: Add the failing desktop browser journey**

    it('temporarily reveals a collapsed desktop rail without opening or moving the feed drawer', () => {
      cy.viewport(1440, 900);
      cy.get('[aria-label="Collapse Activity Bar"]').click();
      cy.get('[data-testid="sidebar-edge-toggle"]').trigger('pointerenter', { pointerType: 'mouse' });
      cy.get('.smart-activity-bar').should('be.visible');
      cy.get('[data-testid="sidebar-edge-toggle"]').trigger('pointerleave', { pointerType: 'mouse' });
      cy.get('.smart-activity-bar').should('not.exist');
    });

- [ ] **Step 2: Run the scoped Cypress command and verify it fails before implementation is complete**

Run: npm run test:e2e:spec -- cypress/e2e/theme-sidebar.cy.ts

Expected: FAIL before Tasks 1-3 exist, or report the Cypress binary as unavailable.

- [ ] **Step 3: Extend the journey after Task 2 and retain mobile coverage**

Assert that pointer entry exposes the rail, focus entry keeps it available, leave retracts it after the grace period, and clicking the edge button makes expansion persistent. Retain existing Paper, Ink, Sepia, High Contrast, 375px, and 767px assertions.

- [ ] **Step 4: Run full frontend verification**

Run: npm run test:unit

Run: npx eslint src && npx eslint --no-ignore cypress/e2e/theme-sidebar.cy.ts

Run: npx prettier --check src cypress/e2e/theme-sidebar.cy.ts

Run: npm run build

Run: git diff --check && git status --short

Expected: unit tests, lint, formatting, build, and diff check pass. Report a missing Cypress binary separately instead of installing it or masking the failure.

- [ ] **Step 5: Commit only Task 4 files**

    git add frontend/cypress/e2e/theme-sidebar.cy.ts
    git commit -m "test(sidebar): cover edge reveal behavior"

## Plan Self-Review

- Spec coverage: Task 1 isolates persistent versus transient state and timing; Task 2 binds pointer/focus behavior, explicit expansion, layering, and mobile preservation; Task 3 provides restrained visual treatment; Task 4 verifies browser behavior, themes, and regressions.
- Placeholder scan: no unresolved placeholders, generic error-handling steps, or undefined interfaces remain.
- Type consistency: isPersistentlyCollapsed, isMobile, isTemporarilyRevealed, isActivityBarVisible, and handler names are defined in Task 1 and consumed unchanged by Task 2.
