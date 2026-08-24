<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { PhFunnel, PhPencil, PhTrash } from '@phosphor-icons/vue';
import type { SavedFilter } from '@/types/filter';

const { t } = useI18n();

interface Props {
  filter: SavedFilter;
  isActive: boolean;
  isDragging?: boolean;
  isEditMode?: boolean;
  compactMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isDragging: false,
  isEditMode: false,
  compactMode: false,
});

const emit = defineEmits<{
  click: [];
  contextmenu: [event: MouseEvent];
  dragstart: [event: Event];
  dragend: [];
  edit: [filter: SavedFilter];
  delete: [filter: SavedFilter];
}>();

// Handle click
function handleClick() {
  emit('click');
}

// Handle context menu
function handleContextMenu(event: MouseEvent) {
  emit('contextmenu', event);
}

// Handle drag start
function handleDragStart(event: Event) {
  emit('dragstart', event);
}

// Handle drag end
function handleDragEnd() {
  emit('dragend');
}

// Handle edit
function handleEdit(event: Event) {
  event.stopPropagation();
  emit('edit', props.filter);
}

// Handle delete
function handleDelete(event: Event) {
  event.stopPropagation();
  emit('delete', props.filter);
}

function handleFilterKeydown(event: KeyboardEvent) {
  if ((event.target as HTMLElement).closest('button')) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  emit('click');
}
</script>

<template>
  <div
    :class="[
      'saved-filter-item cursor-pointer select-none rounded-md transition-all duration-200 border border-transparent flex items-center justify-between gap-1.5 sm:gap-2.5 min-h-11 md:min-h-0',
      isActive ? 'is-active text-accent-text font-medium' : '',
      props.compactMode ? 'px-1 sm:px-1.5 py-0.5 sm:py-1' : 'px-2 sm:px-3 py-1.5 sm:py-2 mx-1',
      isDragging ? 'opacity-50' : '',
    ]"
    role="button"
    tabindex="0"
    :aria-current="isActive ? 'page' : undefined"
    :aria-label="filter.name"
    draggable="true"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @keydown="handleFilterKeydown"
  >
    <!-- Icon and filter name -->
    <div class="flex items-center gap-0.5 sm:gap-1 flex-1 min-w-0">
      <PhFunnel :size="18" class="flex-shrink-0 text-accent-text" />
      <span
        :class="[
          'saved-filter-name whitespace-nowrap overflow-hidden text-ellipsis text-xs sm:text-sm font-medium',
          isActive ? 'text-accent-text' : 'text-text-primary',
        ]"
        >{{ filter.name }}</span
      >
    </div>

    <!-- Edit mode actions -->
    <div v-if="isEditMode" class="flex gap-1">
      <button
        type="button"
        class="saved-filter-edit-button bg-transparent border-0 p-1 cursor-pointer text-text-secondary rounded transition-all duration-200 hover:text-accent-text min-h-11 min-w-11 md:min-h-8 md:min-w-8"
        :title="t('common.edit')"
        :aria-label="t('common.edit')"
        @click="handleEdit"
      >
        <PhPencil :size="14" />
      </button>
      <button
        type="button"
        class="state-danger-hover bg-transparent border-0 p-1 cursor-pointer text-text-secondary rounded transition-all duration-200 min-h-11 min-w-11 md:min-h-8 md:min-w-8"
        :title="t('common.delete')"
        :aria-label="t('common.delete')"
        @click="handleDelete"
      >
        <PhTrash :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.saved-filter-item {
  background-color: transparent;
}

.saved-filter-item:hover {
  background-color: var(--surface-hover);
  color: var(--accent-text-color);
}

.saved-filter-item:hover .saved-filter-name {
  color: var(--accent-text-color);
}

.saved-filter-item.is-active,
.saved-filter-item.is-active:hover {
  background-color: var(--surface-selected);
}

.saved-filter-edit-button:hover {
  background-color: var(--surface-hover);
}
</style>
