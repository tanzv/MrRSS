import { computed, ref } from 'vue';

const SIDEBAR_DRAWER_WIDTH_KEY = 'mrrss.sidebar-drawer-width';
const ARTICLE_LIST_WIDTH_KEY = 'mrrss.article-list-width';

export const SIDEBAR_DRAWER_MIN_WIDTH = 240;
export const SIDEBAR_DRAWER_MAX_WIDTH = 420;
export const SIDEBAR_DRAWER_DEFAULT_WIDTH = 280;

const ARTICLE_LIST_NORMAL_MIN_WIDTH = 280;
const ARTICLE_LIST_NORMAL_MAX_WIDTH = 600;
const ARTICLE_LIST_COMPACT_MIN_WIDTH = 300;
const ARTICLE_LIST_COMPACT_MAX_WIDTH = 800;
const ARTICLE_LIST_NORMAL_DEFAULT_WIDTH = 350;
const ARTICLE_LIST_COMPACT_DEFAULT_WIDTH = 500;

interface PanelWidthBounds {
  min: number;
  max: number;
}

export function getArticleListBounds(compact: boolean): PanelWidthBounds {
  return compact
    ? { min: ARTICLE_LIST_COMPACT_MIN_WIDTH, max: ARTICLE_LIST_COMPACT_MAX_WIDTH }
    : { min: ARTICLE_LIST_NORMAL_MIN_WIDTH, max: ARTICLE_LIST_NORMAL_MAX_WIDTH };
}

export function getArticleListDefaultWidth(compact: boolean): number {
  return compact ? ARTICLE_LIST_COMPACT_DEFAULT_WIDTH : ARTICLE_LIST_NORMAL_DEFAULT_WIDTH;
}

function clampWidth(width: number, { min, max }: PanelWidthBounds): number {
  return Math.min(Math.max(width, min), max);
}

function readSavedWidth(storageKey: string, bounds: PanelWidthBounds): number | null {
  try {
    const savedValue = localStorage.getItem(storageKey);
    if (savedValue === null) return null;

    const width = Number(savedValue);
    if (!Number.isFinite(width) || width < bounds.min || width > bounds.max) {
      return null;
    }

    return width;
  } catch {
    return null;
  }
}

function saveWidth(storageKey: string, width: number): void {
  try {
    localStorage.setItem(storageKey, String(width));
  } catch {
    // The layout still works when browser storage is unavailable.
  }
}

export function useResizablePanels(initialCompactMode = false) {
  const compactMode = ref(initialCompactMode);
  const sidebarPreference = ref(
    readSavedWidth(SIDEBAR_DRAWER_WIDTH_KEY, {
      min: SIDEBAR_DRAWER_MIN_WIDTH,
      max: SIDEBAR_DRAWER_MAX_WIDTH,
    }) ?? SIDEBAR_DRAWER_DEFAULT_WIDTH
  );
  const savedArticleListWidth = readSavedWidth(ARTICLE_LIST_WIDTH_KEY, {
    min: ARTICLE_LIST_NORMAL_MIN_WIDTH,
    max: ARTICLE_LIST_COMPACT_MAX_WIDTH,
  });
  const articleListPreference = ref(
    savedArticleListWidth ?? getArticleListDefaultWidth(compactMode.value)
  );
  const hasArticleListPreference = ref(savedArticleListWidth !== null);

  const sidebarWidth = computed(() =>
    clampWidth(sidebarPreference.value, {
      min: SIDEBAR_DRAWER_MIN_WIDTH,
      max: SIDEBAR_DRAWER_MAX_WIDTH,
    })
  );
  const articleListWidth = computed(() =>
    clampWidth(articleListPreference.value, getArticleListBounds(compactMode.value))
  );

  function setCompactMode(enabled: boolean): void {
    compactMode.value = enabled;
    if (!hasArticleListPreference.value) {
      articleListPreference.value = getArticleListDefaultWidth(enabled);
    }
  }

  function setSidebarWidth(width: number, persist = true): void {
    sidebarPreference.value = clampWidth(width, {
      min: SIDEBAR_DRAWER_MIN_WIDTH,
      max: SIDEBAR_DRAWER_MAX_WIDTH,
    });
    if (persist) commitSidebarWidth();
  }

  function commitSidebarWidth(): void {
    saveWidth(SIDEBAR_DRAWER_WIDTH_KEY, sidebarPreference.value);
  }

  function resetSidebarWidth(): void {
    setSidebarWidth(SIDEBAR_DRAWER_DEFAULT_WIDTH);
  }

  function setArticleListWidth(width: number, persist = true): void {
    articleListPreference.value = clampWidth(width, getArticleListBounds(compactMode.value));
    hasArticleListPreference.value = true;
    if (persist) commitArticleListWidth();
  }

  function commitArticleListWidth(): void {
    saveWidth(ARTICLE_LIST_WIDTH_KEY, articleListPreference.value);
  }

  function resetArticleListWidth(): void {
    setArticleListWidth(getArticleListDefaultWidth(compactMode.value));
  }

  return {
    sidebarWidth,
    articleListWidth,
    setCompactMode,
    setSidebarWidth,
    commitSidebarWidth,
    resetSidebarWidth,
    setArticleListWidth,
    commitArticleListWidth,
    resetArticleListWidth,
  };
}
