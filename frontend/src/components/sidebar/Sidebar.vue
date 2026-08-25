<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick, toRef, watch } from 'vue';
import { PhCaretRight } from '@phosphor-icons/vue';
import { useI18n } from 'vue-i18n';
import { useSidebarEdgeReveal } from '@/composables/ui/useSidebarEdgeReveal';
import {
  SIDEBAR_DRAWER_DEFAULT_WIDTH,
  SIDEBAR_DRAWER_MAX_WIDTH,
  SIDEBAR_DRAWER_MIN_WIDTH,
} from '@/composables/ui/useResizablePanels';
import ActivityBar from './ActivityBar.vue';
import FeedList from './FeedList.vue';
import PanelResizeHandle from '@/components/common/PanelResizeHandle.vue';

interface Props {
  isOpen?: boolean;
  isCompact?: boolean;
  isMobile?: boolean;
  drawerWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: true,
  isCompact: false,
  isMobile: false,
  drawerWidth: SIDEBAR_DRAWER_DEFAULT_WIDTH,
});

const emit = defineEmits<{
  toggle: [];
  'update:drawer-width': [width: number];
}>();

const { t } = useI18n();

// Feed drawer state
const isFeedListExpanded = ref(false);
const isFeedListPinned = ref(false);
const activityBarRef = ref<InstanceType<typeof ActivityBar> | null>(null);
const sidebarToggleContainerRef = ref<HTMLElement | null>(null);
const desktopRevealBridgeRef = ref<HTMLButtonElement | null>(null);
const mobileEdgeToggleRef = ref<HTMLButtonElement | null>(null);
let focusTimer: number | null = null;

// Keep the legacy key so existing users retain their sidebar preference.
const ACTIVITY_BAR_VISIBILITY_STORAGE_KEY = 'ActivityBarCollapsed';
const savedActivityBarVisibility = localStorage.getItem(ACTIVITY_BAR_VISIBILITY_STORAGE_KEY);
const isActivityBarAutoHideEnabled = ref(savedActivityBarVisibility === 'true');
const {
  isTemporarilyRevealed,
  isActivityBarVisible,
  handlePointerEnter,
  handlePointerLeave,
  handleFocusIn,
  handleFocusOut,
  dismissTemporaryReveal,
} = useSidebarEdgeReveal({
  isAutoHideEnabled: isActivityBarAutoHideEnabled,
  isMobile: toRef(props, 'isMobile'),
});

const activityBarVisibilityControl = computed(() => {
  if (props.isMobile) return 'collapse';
  return isActivityBarAutoHideEnabled.value ? 'pin' : 'auto-hide';
});

function saveActivityBarAutoHideState() {
  localStorage.setItem(
    ACTIVITY_BAR_VISIBILITY_STORAGE_KEY,
    String(isActivityBarAutoHideEnabled.value)
  );
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

function hideActivityBar(event?: MouseEvent): void {
  const shouldRestoreKeyboardFocus = event?.detail === 0;
  dismissTemporaryReveal();
  isActivityBarAutoHideEnabled.value = true;
  saveActivityBarAutoHideState();
  if (shouldRestoreKeyboardFocus) {
    nextTick(focusActivityBarRevealControl);
  }
}

function pinActivityBar(): void {
  dismissTemporaryReveal();
  isActivityBarAutoHideEnabled.value = false;
  saveActivityBarAutoHideState();
}

function focusFirstActivityBarAction(): void {
  sidebarToggleContainerRef.value
    ?.querySelector<HTMLElement>('.smart-activity-bar button')
    ?.focus();
}

function focusActivityBarRevealControl(): void {
  (props.isMobile ? mobileEdgeToggleRef.value : desktopRevealBridgeRef.value)?.focus();
}

function focusDesktopPreview(): void {
  nextTick(focusFirstActivityBarAction);
}

function expandMobileActivityBar(event: MouseEvent): void {
  const shouldRestoreKeyboardFocus = event.detail === 0;
  pinActivityBar();
  if (shouldRestoreKeyboardFocus) {
    nextTick(focusFirstActivityBarAction);
  }
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
      'width-auto-hidden': isActivityBarAutoHideEnabled,
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

    <!-- Shared reveal zone and activity bar -->
    <div
      ref="sidebarToggleContainerRef"
      class="sidebar-toggle-container"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
    >
      <button
        v-if="!props.isMobile && isActivityBarAutoHideEnabled"
        ref="desktopRevealBridgeRef"
        type="button"
        class="sidebar-reveal-bridge"
        :aria-label="t('sidebar.activity.showActivityBar')"
        @click="focusDesktopPreview"
      ></button>

      <!-- Mobile retains an explicit expansion control because it has no hover preview. -->
      <Transition name="edge-pin-fade">
        <button
          v-if="props.isMobile && isActivityBarAutoHideEnabled"
          ref="mobileEdgeToggleRef"
          type="button"
          data-testid="sidebar-edge-toggle"
          class="edge-pin-button flex items-center justify-center text-text-secondary hover:text-accent-text"
          :title="t('sidebar.activity.expandActivityBar')"
          :aria-label="t('sidebar.activity.expandActivityBar')"
          :aria-expanded="isActivityBarVisible"
          @click="expandMobileActivityBar"
        >
          <PhCaretRight :size="20" weight="regular" />
        </button>
      </Transition>

      <!-- Smart Activity Bar (Left) -->
      <ActivityBar
        ref="activityBarRef"
        :is-collapsed="!isActivityBarVisible"
        :visibility-control="activityBarVisibilityControl"
        @add-feed="emitShowAddFeed"
        @settings="emitShowSettings"
        @toggle-feed-drawer="handleToggleFeedList"
        @hide-activity-bar="hideActivityBar"
        @pin-activity-bar="pinActivityBar"
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
          { 'activity-bar-auto-hidden': isActivityBarAutoHideEnabled },
        ]"
        :style="{ '--sidebar-drawer-width': `${props.drawerWidth}px` }"
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
        <PanelResizeHandle
          v-if="isFeedListPinned && !props.isMobile"
          data-testid="feed-drawer-resize-handle"
          class="feed-drawer-resize-handle"
          :model-value="props.drawerWidth"
          :min="SIDEBAR_DRAWER_MIN_WIDTH"
          :max="SIDEBAR_DRAWER_MAX_WIDTH"
          :default-value="SIDEBAR_DRAWER_DEFAULT_WIDTH"
          :label="t('sidebar.feedList.resize')"
          @update:model-value="emit('update:drawer-width', $event)"
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

/* Container for the activity bar and its left-edge reveal zone. */
.sidebar-toggle-container {
  position: relative;
  width: 48px;
  min-width: 48px;
  height: 100%;
  flex-shrink: 0;
  /* Width transition happens after button animations */
  transition:
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.15s,
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.15s;
  will-change: width, min-width;
}

/* Auto-hidden desktop rails leave a quiet 16px reveal zone. */
.compact-sidebar-wrapper.width-auto-hidden .sidebar-toggle-container {
  width: 16px;
  min-width: 16px;
}

.compact-sidebar-wrapper.is-edge-revealed .sidebar-toggle-container {
  z-index: 32;
}

.sidebar-reveal-bridge {
  position: absolute;
  inset: 0 auto 0 0;
  width: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: default;
  pointer-events: none;
  z-index: 0;
}

.sidebar-reveal-bridge:focus-visible {
  outline: 2px solid var(--accent-text-color);
  outline-offset: -2px;
  z-index: 31;
}

/* Keep the preview over the drawer instead of changing its flex position. */
.compact-sidebar-wrapper.is-edge-revealed .sidebar-reveal-bridge {
  width: 48px;
  pointer-events: auto;
}

/* The mobile expansion control only appears when the rail is collapsed. */
.edge-pin-fade-enter-active,
.edge-pin-fade-leave-active {
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: opacity;
}

.edge-pin-fade-enter-from,
.edge-pin-fade-leave-to {
  opacity: 0;
}

.edge-pin-fade-enter-to,
.edge-pin-fade-leave-from {
  opacity: 1;
}

/* Mobile devices */
@media (max-width: 767px) {
  .sidebar-toggle-container {
    width: 44px;
    min-width: 44px;
  }

  .compact-sidebar-wrapper.width-auto-hidden .sidebar-toggle-container {
    width: 44px;
    min-width: 44px;
  }

  .edge-pin-button {
    position: absolute;
    left: 0;
    top: 0;
    width: 44px;
    min-width: 44px;
    height: 100%;
    border: 1px solid var(--border-color);
    border-left: 0;
    border-radius: 0;
    background-color: var(--surface-panel);
    cursor: pointer;
    opacity: 1;
    transform: none;
  }

  .edge-pin-button:hover,
  .edge-pin-button:focus-visible {
    background-color: var(--surface-hover);
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

  .compact-sidebar-wrapper.is-compact-shell .feed-drawer-wrapper.pinned.activity-bar-auto-hidden {
    left: 16px;
  }
}

.feed-drawer-wrapper {
  position: relative;
  height: 100%;
  width: var(--sidebar-drawer-width, 280px);
  min-width: var(--sidebar-drawer-width, 280px);
  max-width: calc(100vw - 48px);
  flex-shrink: 0;
}

.feed-drawer-wrapper.pinned {
  box-shadow: none;
}

.feed-drawer-resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  bottom: 0;
  z-index: 35;
}

.feed-drawer-wrapper:not(.pinned) {
  position: absolute;
  left: 48px;
  top: 0;
  bottom: 0;
  z-index: 20;
}

/* An auto-hidden rail leaves the drawer at the edge while a preview overlays it. */
.feed-drawer-wrapper:not(.pinned).activity-bar-auto-hidden {
  left: 16px;
}

/* Mobile devices */
@media (max-width: 767px) {
  .feed-drawer-wrapper:not(.pinned) {
    left: 44px;
  }

  .feed-drawer-wrapper:not(.pinned).activity-bar-auto-hidden {
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

  .compact-sidebar-wrapper.is-mobile-shell .feed-drawer-wrapper.activity-bar-auto-hidden {
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
  .edge-pin-fade-enter-active,
  .edge-pin-fade-leave-active {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
