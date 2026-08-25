import { ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMasonryLayout } from './useMasonryLayout';
import type { Article } from '@/types/models';

const observe = vi.fn();
const disconnect = vi.fn();

class ResizeObserverMock {
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
}

afterEach(() => {
  observe.mockClear();
  disconnect.mockClear();
  vi.unstubAllGlobals();
});

describe('useMasonryLayout', () => {
  it('sets up an observer when the container is already available', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const layout = useMasonryLayout(ref<Article[]>([]));
    const container = document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', { value: 800 });
    layout.containerRef.value = container;

    expect(() => layout.setupResizeObserver()).not.toThrow();
    expect(observe).toHaveBeenCalledWith(container);
  });
});
