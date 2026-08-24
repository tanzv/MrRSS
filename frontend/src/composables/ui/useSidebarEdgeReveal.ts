import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

interface UseSidebarEdgeRevealOptions {
  isPersistentlyCollapsed: Readonly<Ref<boolean>>;
  isMobile: Readonly<Ref<boolean>>;
}

const RELEASE_DELAY_MS = 180;

export function useSidebarEdgeReveal({
  isPersistentlyCollapsed,
  isMobile,
}: UseSidebarEdgeRevealOptions): {
  isTemporarilyRevealed: Readonly<Ref<boolean>>;
  isActivityBarVisible: ComputedRef<boolean>;
  handlePointerEnter: (event: PointerEvent) => void;
  handlePointerLeave: () => void;
  handleFocusIn: () => void;
  handleFocusOut: (event: FocusEvent) => void;
  dismissTemporaryReveal: () => void;
  dispose: () => void;
} {
  const isTemporarilyRevealed = ref(false);
  const isActivityBarVisible = computed(
    () => !isPersistentlyCollapsed.value || isTemporarilyRevealed.value
  );
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let isFocusWithin = false;

  function clearReleaseTimer(): void {
    if (releaseTimer !== undefined) {
      clearTimeout(releaseTimer);
      releaseTimer = undefined;
    }
  }

  function scheduleRelease(): void {
    clearReleaseTimer();
    releaseTimer = setTimeout(() => {
      releaseTimer = undefined;
      isTemporarilyRevealed.value = false;
    }, RELEASE_DELAY_MS);
  }

  function canReveal(): boolean {
    return !isMobile.value && isPersistentlyCollapsed.value;
  }

  function handlePointerEnter(event: PointerEvent): void {
    if (event.pointerType === 'touch' || !canReveal()) {
      return;
    }
    clearReleaseTimer();
    isTemporarilyRevealed.value = true;
  }

  function handlePointerLeave(): void {
    if (isTemporarilyRevealed.value && !isFocusWithin) {
      scheduleRelease();
    }
  }

  function handleFocusIn(): void {
    if (!canReveal()) {
      return;
    }
    isFocusWithin = true;
    clearReleaseTimer();
    isTemporarilyRevealed.value = true;
  }

  function handleFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget;
    if (
      currentTarget instanceof Node &&
      relatedTarget instanceof Node &&
      currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    isFocusWithin = false;
    if (!isTemporarilyRevealed.value || !canReveal()) {
      return;
    }
    scheduleRelease();
  }

  function dismissTemporaryReveal(): void {
    clearReleaseTimer();
    isTemporarilyRevealed.value = false;
  }

  function dispose(): void {
    clearReleaseTimer();
  }

  watch([isPersistentlyCollapsed, isMobile], () => {
    dismissTemporaryReveal();
  });
  onBeforeUnmount(dispose);

  return {
    isTemporarilyRevealed,
    isActivityBarVisible,
    handlePointerEnter,
    handlePointerLeave,
    handleFocusIn,
    handleFocusOut,
    dismissTemporaryReveal,
    dispose,
  };
}
