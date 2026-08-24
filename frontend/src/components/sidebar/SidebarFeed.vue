<script setup lang="ts">
import { ref } from 'vue';
import {
  PhWarningCircle,
  PhEyeSlash,
  PhImage,
  PhDotsSixVertical,
  PhLock,
} from '@phosphor-icons/vue';
import type { Feed } from '@/types/models';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface Props {
  feed: Feed;
  isActive: boolean;
  unreadCount: number;
  isEditMode?: boolean;
  level?: number;
  compactMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isEditMode: false,
  level: 0,
  compactMode: false,
});

const emit = defineEmits<{
  click: [];
  contextmenu: [event: MouseEvent];
  dragstart: [event: Event];
  dragend: [];
}>();

const showErrorTooltip = ref(false);

function getFriendlyErrorMessage(error: string): string {
  if (!error) return '';

  // Network related errors
  if (error.includes('timeout') || error.includes('Timeout')) {
    return t('modal.feed.errorTimeout');
  }
  if (error.includes('connection') || error.includes('Connection')) {
    return t('modal.feed.errorConnection');
  }
  if (error.includes('dns') || error.includes('DNS')) {
    return t('modal.feed.errorDNS');
  }
  if (error.includes('certificate') || error.includes('SSL') || error.includes('TLS')) {
    return t('modal.feed.errorCertificate');
  }

  // HTTP errors
  if (error.includes('404')) {
    return t('modal.feed.errorNotFound');
  }
  if (error.includes('401') || error.includes('403')) {
    return t('modal.feed.errorUnauthorized');
  }
  if (error.includes('500') || error.includes('502') || error.includes('503')) {
    return t('modal.feed.errorServer');
  }

  // Feed format errors
  if (error.includes('XML') || error.includes('parse') || error.includes('invalid')) {
    return t('modal.feed.errorInvalidFormat');
  }

  // Return original error if no specific message found
  return error;
}

function getFavicon(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`;
  } catch {
    return '';
  }
}

function isRSSHubFeed(feed: Feed): boolean {
  return feed.url.startsWith('rsshub://');
}

function handleDragStart(event: Event) {
  emit('dragstart', event);
}

function handleDragEnd() {
  emit('dragend');
}

function handleFeedKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  emit('click');
}
</script>

<template>
  <div
    :class="['feed-item', isActive ? 'active' : '', props.compactMode ? 'compact' : '']"
    :data-feed-id="feed.id"
    :data-level="level || 0"
    role="button"
    tabindex="0"
    :aria-current="isActive ? 'page' : undefined"
    :aria-label="feed.title"
    @click="emit('click')"
    @contextmenu="(e) => emit('contextmenu', e)"
    @keydown="handleFeedKeydown"
  >
    <!-- Drag handle (only visible in edit mode and not for FreshRSS feeds) -->
    <div
      v-if="isEditMode && !feed.is_freshrss_source"
      class="drag-handle"
      draggable="true"
      :title="t('modal.feed.dragToReorder')"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <PhDotsSixVertical :size="14" />
    </div>

    <!-- FreshRSS lock icon (for FreshRSS feeds in edit mode) -->
    <div
      v-if="isEditMode && feed.is_freshrss_source"
      class="freshrss-lock"
      :title="t('setting.freshrss.feedLocked')"
    >
      <PhLock :size="14" />
    </div>

    <div class="w-4 h-4 flex items-center justify-center shrink-0">
      <img
        :src="feed.image_url || getFavicon(feed.url)"
        class="w-full h-full object-contain"
        alt=""
        @error="($event.target as HTMLElement).style.display = 'none'"
      />
    </div>
    <span class="truncate flex-1">{{ feed.title }}</span>

    <!-- RSSHub indicator -->
    <img
      v-if="isRSSHubFeed(feed)"
      src="/assets/plugin_icons/rsshub.svg"
      class="w-3.5 h-3.5 shrink-0"
      :title="t('setting.rsshub.feed')"
      alt="RSSHub"
    />
    <PhImage
      v-if="feed.is_image_mode"
      :size="16"
      class="text-accent-text shrink-0"
      :title="t('setting.feed.imageMode')"
    />
    <PhEyeSlash
      v-if="feed.hide_from_timeline"
      :size="16"
      class="shrink-0"
      :class="isActive ? 'text-accent-text' : 'text-text-secondary'"
      :title="t('setting.reading.hideFromTimeline')"
    />

    <!-- Warning icon with tooltip -->
    <div
      v-if="feed.last_error"
      class="relative shrink-0"
      @mouseenter="showErrorTooltip = true"
      @mouseleave="showErrorTooltip = false"
    >
      <PhWarningCircle :size="16" class="state-warning-icon shrink-0" />

      <!-- Error tooltip -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showErrorTooltip"
          class="sidebar-error-tooltip absolute right-0 top-full mt-2 z-50 w-max max-w-[180px] rounded-lg shadow-xl"
        >
          <div class="px-2.5 py-2">
            <div class="flex items-start gap-2">
              <PhWarningCircle :size="14" class="state-warning-icon shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-text-primary mb-1">
                  {{ t('setting.update.updateFailed') }}
                </div>
                <div class="text-xs text-text-secondary break-words leading-relaxed">
                  {{ getFriendlyErrorMessage(feed.last_error) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
  </div>
</template>

<style scoped>
@reference "../../style.css";
.feed-item {
  @apply px-2 sm:px-3 py-1.5 sm:py-2 cursor-pointer rounded-md text-xs sm:text-sm text-text-primary flex items-center gap-1 transition-colors;
  background-color: transparent;
}

.feed-item:hover {
  background-color: var(--surface-hover);
  color: var(--accent-text-color);
}

@media (max-width: 767px) {
  .feed-item {
    min-height: 44px;
  }
}

/* Compact mode: reduce padding and gap */
.feed-item.compact {
  @apply px-1 sm:px-1.5 py-0.5 sm:py-1 gap-0 sm:gap-0.5;
}

/* Indentation for nested feeds */
.feed-item[data-level='1'] {
  padding-left: calc(0.5rem + 1rem);
}

.feed-item[data-level='2'] {
  padding-left: calc(0.5rem + 2rem);
}

.feed-item[data-level='3'] {
  padding-left: calc(0.5rem + 3rem);
}

.feed-item[data-level='4'] {
  padding-left: calc(0.5rem + 4rem);
}

@media (min-width: 640px) {
  .feed-item[data-level='1'] {
    padding-left: calc(0.75rem + 1rem);
  }

  .feed-item[data-level='2'] {
    padding-left: calc(0.75rem + 2rem);
  }

  .feed-item[data-level='3'] {
    padding-left: calc(0.75rem + 3rem);
  }

  .feed-item[data-level='4'] {
    padding-left: calc(0.75rem + 4rem);
  }
}

/* Compact mode indentation */
.feed-item.compact[data-level='1'] {
  padding-left: calc(0.375rem + 1rem);
}

.feed-item.compact[data-level='2'] {
  padding-left: calc(0.375rem + 2rem);
}

.feed-item.compact[data-level='3'] {
  padding-left: calc(0.375rem + 3rem);
}

.feed-item.compact[data-level='4'] {
  padding-left: calc(0.375rem + 4rem);
}

@media (min-width: 640px) {
  .feed-item.compact[data-level='1'] {
    padding-left: calc(0.5rem + 1rem);
  }

  .feed-item.compact[data-level='2'] {
    padding-left: calc(0.5rem + 2rem);
  }

  .feed-item.compact[data-level='3'] {
    padding-left: calc(0.5rem + 3rem);
  }

  .feed-item.compact[data-level='4'] {
    padding-left: calc(0.5rem + 4rem);
  }
}
.feed-item.active {
  @apply text-accent-text font-medium;
  background-color: var(--surface-selected);
}

/* Dragging state styles */
.feed-item[draggable='true']:active {
  opacity: 0.8;
}
/* Drag ghost image styling - applied during drag */
.feed-item.dragging {
  opacity: 0.5;
  background-color: transparent;
}

.drag-handle {
  @apply cursor-grab text-text-secondary hover:text-accent-text transition-colors flex items-center justify-center;
  padding: 2px;
  margin-right: 2px;
  border-radius: 2px;
}
.drag-handle:hover {
  background-color: var(--surface-hover);
}
.drag-handle:active {
  cursor: grabbing;
}

.freshrss-lock {
  @apply cursor-not-allowed text-text-secondary transition-colors flex items-center justify-center;
  padding: 2px;
  margin-right: 2px;
  border-radius: 2px;
}

.feed-item.active .drag-handle,
.feed-item.active .freshrss-lock {
  color: var(--accent-text-color);
}

.unread-badge {
  @apply text-[9px] sm:text-[10px] font-medium rounded-full min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] px-0.5 sm:px-1 flex items-center justify-center;
  background-color: var(--unread-badge-background);
  color: var(--unread-badge-color);
}

.state-warning-icon {
  color: var(--state-warning-color);
}

.sidebar-error-tooltip {
  background-color: var(--surface-panel);
}
</style>
