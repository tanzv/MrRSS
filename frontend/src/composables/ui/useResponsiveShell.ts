import { onBeforeUnmount, onMounted, ref } from 'vue';

export const COMPACT_SHELL_QUERY = '(max-width: 1279px)';
export const MOBILE_SHELL_QUERY = '(max-width: 767px)';

function getMediaQuery(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia(query);
}

function scheduleFocus(selector: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const focus = () => document.querySelector<HTMLElement>(selector)?.focus();
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(focus);
  } else {
    window.setTimeout(focus, 0);
  }
}

export function useResponsiveShell() {
  const compactMediaQuery = getMediaQuery(COMPACT_SHELL_QUERY);
  const mobileMediaQuery = getMediaQuery(MOBILE_SHELL_QUERY);

  const isCompactViewport = ref(compactMediaQuery?.matches ?? false);
  const isMobileViewport = ref(mobileMediaQuery?.matches ?? false);
  const isNavigationOpen = ref(!isMobileViewport.value);
  let handleMediaChange: (() => void) | null = null;

  function syncViewport(): void {
    const nextIsCompact = compactMediaQuery?.matches ?? false;
    const nextIsMobile = mobileMediaQuery?.matches ?? false;

    isCompactViewport.value = nextIsCompact;
    isMobileViewport.value = nextIsMobile;

    // Mobile navigation is deliberately opt-in; wider layouts keep navigation available.
    if (nextIsMobile) {
      isNavigationOpen.value = false;
    } else if (!nextIsCompact || !isNavigationOpen.value) {
      isNavigationOpen.value = true;
    }
  }

  function openNavigation(): void {
    isNavigationOpen.value = true;
  }

  function closeNavigation(): void {
    isNavigationOpen.value = false;
    scheduleFocus('[data-responsive-nav-trigger]');
  }

  function toggleNavigation(): void {
    if (isNavigationOpen.value) {
      closeNavigation();
    } else {
      openNavigation();
    }
  }

  function handleEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !isMobileViewport.value || !isNavigationOpen.value) {
      return;
    }

    event.preventDefault();
    closeNavigation();
  }

  onMounted(() => {
    syncViewport();
    window.addEventListener('keydown', handleEscape);

    handleMediaChange = () => syncViewport();
    if (compactMediaQuery?.addEventListener) {
      compactMediaQuery.addEventListener('change', handleMediaChange);
    } else {
      compactMediaQuery?.addListener(handleMediaChange);
    }

    if (mobileMediaQuery?.addEventListener) {
      mobileMediaQuery.addEventListener('change', handleMediaChange);
    } else {
      mobileMediaQuery?.addListener(handleMediaChange);
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEscape);

    if (!handleMediaChange) return;

    if (compactMediaQuery?.removeEventListener) {
      compactMediaQuery.removeEventListener('change', handleMediaChange);
    } else {
      compactMediaQuery?.removeListener(handleMediaChange);
    }

    if (mobileMediaQuery?.removeEventListener) {
      mobileMediaQuery.removeEventListener('change', handleMediaChange);
    } else {
      mobileMediaQuery?.removeListener(handleMediaChange);
    }
  });

  return {
    isCompactViewport,
    isMobileViewport,
    isNavigationOpen,
    openNavigation,
    closeNavigation,
    toggleNavigation,
  };
}
