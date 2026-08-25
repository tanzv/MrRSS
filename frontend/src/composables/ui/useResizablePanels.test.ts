import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useResizablePanels } from './useResizablePanels';

const SIDEBAR_DRAWER_WIDTH_KEY = 'mrrss.sidebar-drawer-width';
const ARTICLE_LIST_WIDTH_KEY = 'mrrss.article-list-width';

let wrapper: VueWrapper | undefined;

function mountResizablePanels() {
  let panels: ReturnType<typeof useResizablePanels> | undefined;

  wrapper = mount(
    defineComponent({
      setup() {
        panels = useResizablePanels();
        return () => h('div');
      },
    })
  );

  return panels!;
}

describe('useResizablePanels', () => {
  beforeEach(() => {
    localStorage.removeItem(SIDEBAR_DRAWER_WIDTH_KEY);
    localStorage.removeItem(ARTICLE_LIST_WIDTH_KEY);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    localStorage.removeItem(SIDEBAR_DRAWER_WIDTH_KEY);
    localStorage.removeItem(ARTICLE_LIST_WIDTH_KEY);
  });

  it('falls back to the default widths when saved preferences are invalid', () => {
    localStorage.setItem(SIDEBAR_DRAWER_WIDTH_KEY, 'not-a-number');
    localStorage.setItem(ARTICLE_LIST_WIDTH_KEY, '9000');

    const panels = mountResizablePanels();

    expect(panels.sidebarWidth.value).toBe(280);
    expect(panels.articleListWidth.value).toBe(350);
  });

  it('clamps and persists explicit subscription drawer adjustments', () => {
    const panels = mountResizablePanels();

    panels.setSidebarWidth(500);
    expect(panels.sidebarWidth.value).toBe(420);
    expect(localStorage.getItem(SIDEBAR_DRAWER_WIDTH_KEY)).toBe('420');

    panels.setSidebarWidth(120);
    expect(panels.sidebarWidth.value).toBe(240);
    expect(localStorage.getItem(SIDEBAR_DRAWER_WIDTH_KEY)).toBe('240');

    panels.resetSidebarWidth();
    expect(panels.sidebarWidth.value).toBe(280);
    expect(localStorage.getItem(SIDEBAR_DRAWER_WIDTH_KEY)).toBe('280');
  });

  it('commits final drag widths without writing every intermediate value', () => {
    const panels = mountResizablePanels();

    panels.setSidebarWidth(320, false);
    expect(localStorage.getItem(SIDEBAR_DRAWER_WIDTH_KEY)).toBeNull();
    panels.commitSidebarWidth();
    expect(localStorage.getItem(SIDEBAR_DRAWER_WIDTH_KEY)).toBe('320');

    panels.setArticleListWidth(440, false);
    expect(localStorage.getItem(ARTICLE_LIST_WIDTH_KEY)).toBeNull();
    panels.commitArticleListWidth();
    expect(localStorage.getItem(ARTICLE_LIST_WIDTH_KEY)).toBe('440');
  });

  it('preserves a compact article-list preference while clamping its normal presentation', () => {
    const panels = mountResizablePanels();

    panels.setCompactMode(true);
    expect(panels.articleListWidth.value).toBe(500);

    panels.setArticleListWidth(720);
    expect(localStorage.getItem(ARTICLE_LIST_WIDTH_KEY)).toBe('720');

    panels.setCompactMode(false);
    expect(panels.articleListWidth.value).toBe(600);
    expect(localStorage.getItem(ARTICLE_LIST_WIDTH_KEY)).toBe('720');

    panels.setCompactMode(true);
    expect(panels.articleListWidth.value).toBe(720);

    panels.resetArticleListWidth();
    expect(panels.articleListWidth.value).toBe(500);
    expect(localStorage.getItem(ARTICLE_LIST_WIDTH_KEY)).toBe('500');
  });
});
