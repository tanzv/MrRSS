import { nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useSidebarEdgeReveal } from './useSidebarEdgeReveal';

describe('useSidebarEdgeReveal', () => {
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
    state.handleFocusOut({ currentTarget: region, relatedTarget: second } as FocusEvent);
    expect(state.isTemporarilyRevealed.value).toBe(true);
    state.handleFocusOut({ currentTarget: region, relatedTarget: document.body } as FocusEvent);
    vi.advanceTimersByTime(180);
    expect(state.isTemporarilyRevealed.value).toBe(false);
    vi.useRealTimers();
  });

  it('does not reveal for touch, mobile, or an expanded rail', () => {
    const collapsed = ref(true);
    const mobile = ref(false);
    const state = useSidebarEdgeReveal({ isPersistentlyCollapsed: collapsed, isMobile: mobile });

    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    expect(state.isTemporarilyRevealed.value).toBe(false);
    mobile.value = true;
    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    expect(state.isTemporarilyRevealed.value).toBe(false);
    mobile.value = false;
    collapsed.value = false;
    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    expect(state.isTemporarilyRevealed.value).toBe(false);
    expect(state.isActivityBarVisible.value).toBe(true);
  });

  it('retracts after pointer leave and cancels release when re-entered', () => {
    vi.useFakeTimers();
    const state = useSidebarEdgeReveal({
      isPersistentlyCollapsed: ref(true),
      isMobile: ref(false),
    });
    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    state.handlePointerLeave();
    vi.advanceTimersByTime(179);
    expect(state.isTemporarilyRevealed.value).toBe(true);
    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(180);
    expect(state.isTemporarilyRevealed.value).toBe(true);
    vi.useRealTimers();
  });

  it('clears transient state when persistence or mobile mode changes', async () => {
    vi.useFakeTimers();
    const collapsed = ref(true);
    const mobile = ref(false);
    const state = useSidebarEdgeReveal({ isPersistentlyCollapsed: collapsed, isMobile: mobile });
    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    state.handlePointerLeave();
    collapsed.value = false;
    await nextTick();
    expect(state.isTemporarilyRevealed.value).toBe(false);
    vi.advanceTimersByTime(180);
    mobile.value = true;
    await nextTick();
    expect(state.isTemporarilyRevealed.value).toBe(false);
    vi.useRealTimers();
  });

  it('dismisses and disposes the pending reveal release', () => {
    vi.useFakeTimers();
    const state = useSidebarEdgeReveal({
      isPersistentlyCollapsed: ref(true),
      isMobile: ref(false),
    });
    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    state.handlePointerLeave();
    state.dismissTemporaryReveal();
    expect(state.isTemporarilyRevealed.value).toBe(false);
    vi.advanceTimersByTime(180);
    expect(state.isTemporarilyRevealed.value).toBe(false);
    state.handlePointerEnter(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    state.dispose();
    vi.advanceTimersByTime(180);
    expect(state.isTemporarilyRevealed.value).toBe(true);
    vi.useRealTimers();
  });
});
