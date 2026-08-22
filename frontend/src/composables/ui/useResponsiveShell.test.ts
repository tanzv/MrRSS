import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useResponsiveShell } from './useResponsiveShell';

interface MediaController {
  setMatches: (matches: boolean) => void;
}

let wrapper: VueWrapper | undefined;
let originalMatchMedia: typeof window.matchMedia;

function mockMedia(matchesByQuery: Record<string, boolean>): MediaController[] {
  const controllers: MediaController[] = [];

  originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn((query: string) => {
    let matches = matchesByQuery[query] ?? false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const controller = {
      setMatches(nextMatches: boolean) {
        matches = nextMatches;
        const event = { matches, media: query } as MediaQueryListEvent;
        listeners.forEach((listener) => listener(event));
      },
    };

    controllers.push(controller);

    return {
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      dispatchEvent: () => false,
    } as MediaQueryList;
  });

  return controllers;
}

function mountResponsiveShell() {
  let state: ReturnType<typeof useResponsiveShell>;

  wrapper = mount(
    defineComponent({
      setup() {
        state = useResponsiveShell();
        return () => h('div');
      },
    })
  );

  return state!;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
  }
  document.body.innerHTML = '';
});

describe('useResponsiveShell', () => {
  it('starts closed on mobile and open on desktop', () => {
    const controllers = mockMedia({
      '(max-width: 1279px)': true,
      '(max-width: 767px)': true,
    });

    const state = mountResponsiveShell();

    expect(controllers).toHaveLength(2);
    expect(state.isCompactViewport.value).toBe(true);
    expect(state.isMobileViewport.value).toBe(true);
    expect(state.isNavigationOpen.value).toBe(false);
  });

  it('starts navigation open outside the mobile breakpoint', () => {
    mockMedia({
      '(max-width: 1279px)': true,
      '(max-width: 767px)': false,
    });

    const state = mountResponsiveShell();

    expect(state.isCompactViewport.value).toBe(true);
    expect(state.isMobileViewport.value).toBe(false);
    expect(state.isNavigationOpen.value).toBe(true);
  });

  it('closes on Escape and returns focus to the navigation trigger', async () => {
    mockMedia({
      '(max-width: 1279px)': true,
      '(max-width: 767px)': true,
    });
    const trigger = document.createElement('button');
    trigger.dataset.responsiveNavTrigger = 'true';
    document.body.append(trigger);

    const state = mountResponsiveShell();
    state.openNavigation();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(state.isNavigationOpen.value).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('updates viewport flags when media queries change', async () => {
    const controllers = mockMedia({
      '(max-width: 1279px)': false,
      '(max-width: 767px)': false,
    });
    const state = mountResponsiveShell();

    controllers[0].setMatches(true);
    controllers[1].setMatches(true);
    await nextTick();

    expect(state.isCompactViewport.value).toBe(true);
    expect(state.isMobileViewport.value).toBe(true);
    expect(state.isNavigationOpen.value).toBe(false);
  });
});
