<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

interface Props {
  modelValue: number;
  min: number;
  max: number;
  defaultValue: number;
  label: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
  'resize-start': [];
  'resize-end': [];
}>();

const handleRef = ref<HTMLElement | null>(null);
const isResizing = ref(false);
let activePointerId: number | null = null;
let initialPointerX = 0;
let initialWidth = 0;
let previousBodyCursor = '';
let previousBodyUserSelect = '';

function clampWidth(width: number): number {
  return Math.min(Math.max(width, props.min), props.max);
}

function updateWidth(width: number): void {
  emit('update:modelValue', clampWidth(width));
}

function handleKeydown(event: KeyboardEvent): void {
  const step = event.shiftKey ? 48 : 16;

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      updateWidth(props.modelValue - step);
      break;
    case 'ArrowRight':
      event.preventDefault();
      updateWidth(props.modelValue + step);
      break;
    case 'Home':
      event.preventDefault();
      updateWidth(props.min);
      break;
    case 'End':
      event.preventDefault();
      updateWidth(props.max);
      break;
  }
}

function resetWidth(): void {
  updateWidth(props.defaultValue);
}

function startResize(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0 || isResizing.value) return;

  activePointerId = event.pointerId;
  initialPointerX = event.clientX;
  initialWidth = props.modelValue;
  previousBodyCursor = document.body.style.cursor;
  previousBodyUserSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  isResizing.value = true;
  emit('resize-start');
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

function resize(event: PointerEvent): void {
  if (!isResizing.value || event.pointerId !== activePointerId) return;

  updateWidth(initialWidth + event.clientX - initialPointerX);
}

function stopResize(event?: PointerEvent): void {
  if (!isResizing.value || (event && event.pointerId !== activePointerId)) return;

  const pointerId = activePointerId;
  const target =
    event?.currentTarget instanceof HTMLElement ? event.currentTarget : handleRef.value;
  activePointerId = null;
  isResizing.value = false;
  document.body.style.cursor = previousBodyCursor;
  document.body.style.userSelect = previousBodyUserSelect;

  if (pointerId !== null) {
    try {
      target?.releasePointerCapture(pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
  }

  emit('resize-end');
}

onBeforeUnmount(() => stopResize());
</script>

<template>
  <div
    ref="handleRef"
    class="panel-resize-handle"
    :class="{ 'is-resizing': isResizing }"
    role="separator"
    tabindex="0"
    :aria-label="props.label"
    aria-orientation="vertical"
    :aria-valuemin="props.min"
    :aria-valuemax="props.max"
    :aria-valuenow="props.modelValue"
    @keydown="handleKeydown"
    @pointerdown="startResize"
    @pointermove="resize"
    @pointerup="stopResize"
    @pointercancel="stopResize"
    @lostpointercapture="stopResize"
    @dblclick="resetWidth"
  ></div>
</template>

<style scoped>
.panel-resize-handle {
  position: relative;
  display: block;
  align-self: stretch;
  width: 6px;
  min-width: 6px;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}

.panel-resize-handle::before {
  position: absolute;
  inset: 0 auto 0 50%;
  width: 1px;
  content: '';
  background-color: var(--border-color);
  opacity: 0;
  transform: translateX(-50%);
}

.panel-resize-handle:hover::before,
.panel-resize-handle:focus-visible::before,
.panel-resize-handle.is-resizing::before {
  background-color: var(--accent-color);
  opacity: 1;
}
</style>
