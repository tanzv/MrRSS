<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, toRef, watch } from 'vue';
import { PhCaretRight } from '@phosphor-icons/vue';
import { useI18n } from 'vue-i18n';
import { useSidebarEdgeReveal } from '@/composables/ui/useSidebarEdgeReveal';
import ActivityBar from './ActivityBar.vue';
import FeedList from './FeedList.vue';

interface Props {
  isOpen?: boolean;
  isCompact?: boolean;
  isMobile?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: true,
  isCompact: false,
  isMobile: false,
});

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();

// Feed drawer state
const isFeedListExpanded = ref(false);
const isFeedListPinned = ref(false);
const activityBarRef = ref<InstanceType<typeof ActivityBar> | null>(null);
let focusTimer: number | null = null;

// Activity bar collapse state - use localStorage for persistence
const savedActivityBarCollapsed = localStorage.getItem('ActivityBarCollapsed');
const isActivityBarCollapsed = ref(savedActivityBarCollapsed === 'true');
const {
  isTemporarilyRevealed,
  isActivityBarVisible,
  handlePointerEnter,
  handlePointerLeave,
  handleFocusIn,
  handleFocusOut,
  dismissTemporaryReveal,
} = useSidebarEdgeReveal({
  isPersistentlyCollapsed: isActivityBarCollapsed,
  isMobile: toRef(props, 'isMobile'),
});

// Save activity bar state to localStorage
function saveActivityBarState() {
  localStorage.setItem('ActivityBarCollapsed', String(isActivityBarCollapsed.value));
}

// Handle ready event from ActivityBar
function handleActivityBarReady(state: { expanded: boolean; pinned: boolean }) {
  isFeedListExpanded.value = state.expanded;
  isFeedListPinned.value = state.pinned;
}

// Initialize state from ActivityBar after mount (fallback)
onMounted(async () => {
  await nextTick();

  // Fallback: if ready event doesn't fire, try reading state after delay
  setTimeout(() => {
    if (activityBarRef.value) {
      const expanded = activityBarRef.value.isFeedListExpanded;
      const pinned = activityBarRef.value.isFeedListPinned;

      // Only update if not already set by ready event
      if (isFeedListExpanded.value === false && expanded === true) {
        isFeedListExpanded.value = expanded;
        isFeedListPinned.value = pinned;
      }
    }
  }, 300);
});

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen && props.isMobile && isFeedListExpanded.value) {
      isFeedListExpanded.value = false;
      updateActivityBarState();
    }
  }
);

function handleFeedListExpand() {
  isFeedListExpanded.value = true;
  updateActivityBarState();
}

function handleFeedListCollapse() {
  isFeedListExpanded.value = false;
  updateActivityBarState();
  if (props.isMobile && props.isOpen) {
    emit('toggle');
  }
}

function handlePinFeedList() {
  isFeedListPinned.value = true;
  isFeedListExpanded.value = true;
  updateActivityBarState();
}

function handleUnpinFeedList() {
  isFeedListPinned.value = false;
  // Keep expanded when unpinning - don't collapse
  updateActivityBarState();
}

function handleToggleFeedList() {
  // Only toggle expand/collapse state
  // Pinned state should remain unchanged and only be controlled via the pin button in FeedList
  isFeedListExpanded.value = !isFeedListExpanded.value;
  updateActivityBarState();
}

// Update activity bar state when drawer state changes
function updateActivityBarState() {
  if (activityBarRef.value) {
    activityBarRef.value.handleFeedListStateChange(
      isFeedListExpanded.value,
      isFeedListPinned.value
    );
  }
}

function emitShowAddFeed() {
  if (props.isMobile && props.isOpen) emit('toggle');
  window.dispatchEvent(new CustomEvent('show-add-feed'));
}

function emitShowSettings() {
  if (props.isMobile && props.isOpen) emit('toggle');
  window.dispatchEvent(new CustomEvent('show-settings'));
}

function handleActivityFilterSelect() {
  if (props.isMobile && props.isOpen) emit('toggle');
}

function handleBackdropClick() {
  if (props.isMobile) {
    emit('toggle');
    return;
  }

  handleFeedListCollapse();
}

function focusMobileDrawer() {
  const focusCloseButton = () => {
    document.querySelector<HTMLElement>('[data-responsive-nav-close]')?.focus();
  };

  if (focusTimer !== null) window.clearTimeout(focusTimer);
  nextTick(() => {
    if (!props.isOpen || !props.isMobile) return;
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusCloseButton);
    } else {
      window.setTimeout(focusCloseButton, 0);
    }
    // The drawer is rendered through a transition; retry once after its vnode mounts.
    focusTimer = window.setTimeout(focusCloseButton, 60);
  });
}

function toggleActivityBar() {
  if (isActivityBarCollapsed.value) {
    dismissTemporaryReveal();
    return;
  }

  isActivityBarCollapsed.value = true;
  saveActivityBarState();
}

function persistExpandedFromEdge() {
  dismissTemporaryReveal();
  isActivityBarCollapsed.value = false;
  saveActivityBarState();
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen && focusTimer !== null) {
      window.clearTimeout(focusTimer);
      focusTimer = null;
    }
    if (isOpen && props.isMobile && !isFeedListExpanded.value) {
      isFeedListExpanded.value = true;
      updateActivityBarState();
    }
    if (isOpen && props.isMobile) focusMobileDrawer();
  }
);

onBeforeUnmount(() => {
  if (focusTimer !== null) window.clearTimeout(focusTimer);
});
</script>

<template>
  <div
    class="compact-sidebar-wrapper flex h-full relative"
    :class="{
      'width-collapsed': isActivityBarCollapsed,
      'is-edge-revealed': isTemporarilyRevealed,
      'is-compact-shell': props.isCompact,
      'is-mobile-shell': props.isMobile,
      'is-shell-open': props.isOpen,
    }"
    :aria-hidden="props.isMobile && !props.isOpen ? 'true' : undefined"
  >
    <button
      v-if="props.isCompact && (props.isMobile ? props.isOpen : isFeedListExpanded)"
      type="button"
      class="responsive-sidebar-backdrop"
      :aria-label="t('common.close')"
      @click="handleBackdropClick"
    ></button>

    <!-- Shared container for ActivityBar and Edge Toggle -->
    <div
      class="sidebar-toggle-container"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
    >
      <!-- Edge Toggle Button (visible when ActivityBar is collapsed) -->
      <Transition name="edge-toggle-fade">
        <button
          v-if="isActivityBarCollapsed"
          type="button"
          data-testid="sidebar-edge-toggle"
          class="edge-toggle-button flex items-center justify-center text-text-secondary hover:text-accent-text transition-all"
          :title="t('sidebar.activity.expandActivityBar')"
          :aria-expanded="isActivityBarVisible"
          @click="persistExpandedFromEdge"
        >
          <PhCaretRight :size="20" weight="regular" />
        </button>
      </Transition>

      <!-- Smart Activity Bar (Left) -->
      <ActivityBar
        ref="activityBarRef"
        :is-collapsed="!isActivityBarVisible"
        @add-feed="emitShowAddFeed"
        @settings="emitShowSettings"
        @toggle-feed-drawer="handleToggleFeedList"
        @toggle-activity-bar="toggleActivityBar"
        @select-filter="handleActivityFilterSelect"
        @ready="handleActivityBarReady"
      />
    </div>

    <!-- Feed Drawer -->
    <Transition name="drawer-position">
      <div
        v-if="isFeedListExpanded"
        class="feed-drawer-wrapper"
        :class="[
          { pinned: isFeedListPinned },
          { 'activity-bar-collapsed': isActivityBarCollapsed },
        ]"
      >
        <FeedList
          :is-expanded="isFeedListExpanded"
          :is-pinned="isFeedListPinned"
          :is-mobile="props.isMobile"
          @expand="handleFeedListExpand"
          @collapse="handleFeedListCollapse"
          @pin="handlePinFeedList"
          @unpin="handleUnpinFeedList"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.compact-sidebar-wrapper {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: stretch;
  /* Smooth width transition between collapsed/expanded states */
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: width;
}

.responsive-sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 19;
  border: 0;
  background: var(--overlay-backdrop);
  cursor: default;
}

/* Container for both ActivityBar and Edge Toggle - uses absolute positioning */
.sidebar-toggle-container {
  position: relative;
  width: 56px;
  min-width: 56px;
  height: 100%;
  flex-shrink: 0;
  /* Width transition happens after button animations */
  transition:
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.15s,
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.15s;
  will-change: width, min-width;
}

/* When collapsed, container shrinks to edge toggle button width */
.compact-sidebar-wrapper.width-collapsed .sidebar-toggle-container {
  width: 16px;
  min-width: 16px;
}

.compact-sidebar-wrapper.is-edge-revealed .sidebar-toggle-container {
  z-index: 32;
}

/* Edge toggle button - absolutely positioned in shared space */
.edge-toggle-button {
  position: absolute;
  left: 0;
  top: 0;
  width: 16px;
  height: 100%;
  border-right: 1px solid var(--border-color);
  background-color: var(--surface-panel);
  cursor: pointer;
  z-index: 16;
  transition: background-color 0.2s;
}

.edge-toggle-button:hover {
  background-color: var(--surface-hover);
}

/* Edge toggle fade transition - faster than container width change */
.edge-toggle-fade-enter-active,
.edge-toggle-fade-leave-active {
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: opacity;
}

.edge-toggle-fade-enter-from,
.edge-toggle-fade-leave-to {
  opacity: 0;
}

.edge-toggle-fade-enter-to,
.edge-toggle-fade-leave-from {
  opacity: 1;
}

/* Smaller screens (laptops, tablets) */
@media (max-width: 1400px) {
  .sidebar-toggle-container {
    width: 48px;
    min-width: 48px;
  }

  .compact-sidebar-wrapper.width-collapsed .sidebar-toggle-container {
    width: 16px;
    min-width: 16px;
  }
}

/* Mobile devices */
@media (max-width: 767px) {
  .sidebar-toggle-container {
    width: 44px;
    min-width: 44px;
  }

  .compact-sidebar-wrapper.width-collapsed .sidebar-toggle-container {
    width: 44px;
    min-width: 44px;
  }

  .edge-toggle-button {
    width: 44px;
    min-width: 44px;
  }
}

/* Tablet keeps the rail in flow while the feed drawer floats over content. */
@media (min-width: 768px) and (max-width: 1279px) {
  .compact-sidebar-wrapper.is-compact-shell {
    width: 48px;
    min-width: 48px;
  }

  .compact-sidebar-wrapper.is-compact-shell .feed-drawer-wrapper.pinned {
    position: absolute;
    left: 48px;
    top: 0;
    bottom: 0;
    z-index: 30;
  }

  .compact-sidebar-wrapper.is-compact-shell .feed-drawer-wrapper.pinned.activity-bar-collapsed {
    left: 16px;
  }
}

.feed-drawer-wrapper {
  position: relative;
  height: 100%;
  flex-shrink: 0;
}

.feed-drawer-wrapper:not(.pinned) {
  position: absolute;
  left: 56px;
  top: 0;
  bottom: 0;
  z-index: 20;
}

/* When activity bar is collapsed, feed drawer should start from edge toggle button */
.feed-drawer-wrapper:not(.pinned).activity-bar-collapsed {
  left: 16px;
}

/* Smaller screens (laptops, tablets) */
@media (max-width: 1400px) {
  .feed-drawer-wrapper:not(.pinned) {
    left: 48px;
  }

  .feed-drawer-wrapper:not(.pinned).activity-bar-collapsed {
    left: 16px;
  }
}

/* Mobile devices */
@media (max-width: 767px) {
  .feed-drawer-wrapper:not(.pinned) {
    left: 44px;
  }

  .feed-drawer-wrapper:not(.pinned).activity-bar-collapsed {
    left: 16px;
  }
}

/* Drawer position transition */
.drawer-position-enter-active {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
  will-change: transform, opacity;
}

.drawer-position-leave-active {
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
  will-change: transform, opacity;
}

.drawer-position-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}

.drawer-position-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

.drawer-position-enter-to,
.drawer-position-leave-from {
  opacity: 1;
  transform: translateX(0);
}

/* Optimize feed drawer rendering */
.feed-drawer-wrapper {
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  transform: translateZ(0);
  box-shadow: var(--overlay-shadow, none);
}

/* Mobile navigation is an off-canvas surface and never consumes reader width. */
@media (max-width: 767px) {
  .compact-sidebar-wrapper.is-mobile-shell {
    position: fixed;
    inset: 0;
    width: 100vw;
    min-width: 100vw;
    height: 100dvh;
    z-index: 50;
    transform: translateX(-100%);
    pointer-events: none;
    visibility: hidden;
    transition:
      transform 0.24s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0.24s linear;
    will-change: transform;
  }

  .compact-sidebar-wrapper.is-mobile-shell.is-shell-open {
    transform: translateX(0);
    pointer-events: auto;
    visibility: visible;
  }

  .compact-sidebar-wrapper.is-mobile-shell .sidebar-toggle-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 44px;
    min-width: 44px;
    height: 100%;
    z-index: 30;
  }

  .compact-sidebar-wrapper.is-mobile-shell .feed-drawer-wrapper,
  .compact-sidebar-wrapper.is-mobile-shell .feed-drawer-wrapper.pinned,
  .compact-sidebar-wrapper.is-mobile-shell .feed-drawer-wrapper:not(.pinned) {
    position: absolute;
    left: 44px !important;
    top: 0;
    bottom: 0;
    width: min(300px, calc(100vw - 44px));
    min-width: min(300px, calc(100vw - 44px));
    max-width: calc(100vw - 44px);
    z-index: 31;
  }

  .compact-sidebar-wrapper.is-mobile-shell .feed-drawer-wrapper.activity-bar-collapsed {
    left: 44px !important;
  }

  .compact-sidebar-wrapper.is-mobile-shell .reader-feed-drawer {
    width: min(300px, calc(100vw - 44px)) !important;
    min-width: min(300px, calc(100vw - 44px)) !important;
  }

  .compact-sidebar-wrapper.is-mobile-shell .responsive-sidebar-backdrop {
    z-index: 20;
  }
}

/* Overlay transition */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: opacity;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.overlay-fade-enter-to,
.overlay-fade-leave-from {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .compact-sidebar-wrapper,
  .compact-sidebar-wrapper *,
  .drawer-position-enter-active,
  .drawer-position-leave-active,
  .edge-toggle-fade-enter-active,
  .edge-toggle-fade-leave-active {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
