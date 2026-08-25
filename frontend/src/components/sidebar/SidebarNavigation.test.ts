import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import en from '@/i18n/locales/en';
import ActivityBar from './ActivityBar.vue';
import Sidebar from './Sidebar.vue';
import SidebarCategory from './SidebarCategory.vue';
import SidebarFeed from './SidebarFeed.vue';
import SavedFilterItem from './SavedFilterItem.vue';
import type { Feed } from '@/types/models';
import type { SavedFilter } from '@/types/filter';

let wrappers: VueWrapper[] = [];

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en },
});

const feed = {
  id: 1,
  title: 'Daily Feed',
  url: 'https://example.com/feed.xml',
  category: 'News',
  is_freshrss_source: false,
  is_image_mode: false,
  hide_from_timeline: false,
  last_error: '',
} as Feed;

const savedFilter = {
  id: 1,
  name: 'Unread from Daily Feed',
  conditions: '[]',
  position: 0,
  created_at: '2026-08-23T00:00:00.000Z',
  updated_at: '2026-08-23T00:00:00.000Z',
} as SavedFilter;

const activityBarStub = {
  props: ['isCollapsed'],
  emits: ['hide-activity-bar'],
  template: `
    <button
      v-if="!isCollapsed"
      type="button"
      data-testid="activity-bar-hide"
      @click="$emit('hide-activity-bar', $event)"
    >
      Hide activity bar
    </button>
  `,
};

const drawerActivityBarStub = {
  name: 'ActivityBar',
  emits: ['ready'],
  template: '<div data-testid="drawer-activity-bar" />',
};

const drawerFeedListStub = {
  name: 'FeedList',
  props: ['isExpanded', 'isPinned', 'isMobile'],
  template: '<div class="reader-feed-drawer" />',
};

const activityBarSource = readFileSync(
  resolve(process.cwd(), 'src/components/sidebar/ActivityBar.vue'),
  'utf8'
);
const feedListSource = readFileSync(
  resolve(process.cwd(), 'src/components/sidebar/FeedList.vue'),
  'utf8'
);
const sidebarFeedSource = readFileSync(
  resolve(process.cwd(), 'src/components/sidebar/SidebarFeed.vue'),
  'utf8'
);
const sidebarCategorySource = readFileSync(
  resolve(process.cwd(), 'src/components/sidebar/SidebarCategory.vue'),
  'utf8'
);
const sidebarSource = readFileSync(
  resolve(process.cwd(), 'src/components/sidebar/Sidebar.vue'),
  'utf8'
);
const savedFilterSource = readFileSync(
  resolve(process.cwd(), 'src/components/sidebar/SavedFilterItem.vue'),
  'utf8'
);

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount());
  wrappers = [];
});

describe('reader navigation semantics', () => {
  it('labels activity controls and exposes the active filter', async () => {
    const wrapper = mount(ActivityBar, {
      global: { plugins: [createPinia(), i18n] },
    });
    wrappers.push(wrapper);
    await nextTick();

    const allArticles = wrapper.find('button[title="All Articles"]');
    expect(allArticles.attributes('aria-label')).toBe('All Articles');
    expect(allArticles.attributes('aria-current')).toBe('page');
    expect(allArticles.attributes('data-active')).toBe('true');
    expect(allArticles.classes()).not.toContain('text-accent');
    expect(wrapper.find('nav').attributes('aria-label')).toBe('Article filters');
  });

  it('shows the matching visibility action in each activity-bar mode', async () => {
    const fixedWrapper = mount(ActivityBar, {
      props: { visibilityControl: 'auto-hide' },
      global: { plugins: [createPinia(), i18n] },
    });
    wrappers.push(fixedWrapper);

    const autoHideControl = fixedWrapper.get('button[aria-label="Auto-hide Activity Bar"]');
    expect(autoHideControl.attributes('title')).toBe('Auto-hide Activity Bar');
    await autoHideControl.trigger('click');
    expect(fixedWrapper.emitted('hide-activity-bar')).toHaveLength(1);

    const previewWrapper = mount(ActivityBar, {
      props: { visibilityControl: 'pin' },
      global: { plugins: [createPinia(), i18n] },
    });
    wrappers.push(previewWrapper);

    const pinControl = previewWrapper.get('button[aria-label="Keep Activity Bar Visible"]');
    expect(pinControl.attributes('title')).toBe('Keep Activity Bar Visible');
    await pinControl.trigger('click');
    expect(previewWrapper.emitted('pin-activity-bar')).toHaveLength(1);
    expect(previewWrapper.find('button[aria-label="Auto-hide Activity Bar"]').exists()).toBe(false);
    expect(previewWrapper.find('button[aria-label="Collapse Activity Bar"]').exists()).toBe(false);

    const mobileWrapper = mount(ActivityBar, {
      props: { visibilityControl: 'collapse' },
      global: { plugins: [createPinia(), i18n] },
    });
    wrappers.push(mobileWrapper);

    const collapseControl = mobileWrapper.get('button[aria-label="Collapse Activity Bar"]');
    await collapseControl.trigger('click');
    expect(mobileWrapper.emitted('hide-activity-bar')).toHaveLength(1);
  });

  it('returns keyboard focus to the desktop reveal zone after auto-hiding the rail', async () => {
    localStorage.setItem('ActivityBarCollapsed', 'false');
    const wrapper = mount(Sidebar, {
      attachTo: document.body,
      global: {
        plugins: [createPinia(), i18n],
        stubs: {
          ActivityBar: activityBarStub,
          FeedList: { template: '<div />' },
        },
      },
    });
    wrappers.push(wrapper);

    wrapper
      .get('[data-testid="activity-bar-hide"]')
      .element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(wrapper.get('.sidebar-reveal-bridge').element);
  });

  it('returns keyboard focus to the mobile expand control after collapsing the rail', async () => {
    localStorage.setItem('ActivityBarCollapsed', 'false');
    const wrapper = mount(Sidebar, {
      props: { isMobile: true, isOpen: true },
      attachTo: document.body,
      global: {
        plugins: [createPinia(), i18n],
        stubs: {
          ActivityBar: activityBarStub,
          FeedList: { template: '<div />' },
        },
      },
    });
    wrappers.push(wrapper);

    wrapper
      .get('[data-testid="activity-bar-hide"]')
      .element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="sidebar-edge-toggle"]').element);
  });

  it('shows a width separator only for a pinned desktop subscription drawer', async () => {
    localStorage.setItem('ActivityBarCollapsed', 'false');
    const wrapper = mount(Sidebar, {
      props: { drawerWidth: 320 },
      global: {
        plugins: [createPinia(), i18n],
        stubs: {
          ActivityBar: drawerActivityBarStub,
          FeedList: drawerFeedListStub,
        },
      },
    });
    wrappers.push(wrapper);

    const activityBar = wrapper.findComponent({ name: 'ActivityBar' });
    activityBar.vm.$emit('ready', { expanded: true, pinned: true });
    await nextTick();

    const handle = wrapper.get('[data-testid="feed-drawer-resize-handle"]');
    expect(handle.attributes('aria-label')).toBe('Resize subscription sources');
    expect(handle.attributes('aria-valuenow')).toBe('320');
    expect(
      wrapper.get('.feed-drawer-wrapper').element.style.getPropertyValue('--sidebar-drawer-width')
    ).toBe('320px');

    await handle.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:drawer-width')).toEqual([[336]]);

    activityBar.vm.$emit('ready', { expanded: true, pinned: false });
    await nextTick();
    expect(wrapper.find('[data-testid="feed-drawer-resize-handle"]').exists()).toBe(false);

    const mobileWrapper = mount(Sidebar, {
      props: { drawerWidth: 320, isMobile: true, isOpen: true },
      global: {
        plugins: [createPinia(), i18n],
        stubs: {
          ActivityBar: drawerActivityBarStub,
          FeedList: drawerFeedListStub,
        },
      },
    });
    wrappers.push(mobileWrapper);
    mobileWrapper
      .findComponent({ name: 'ActivityBar' })
      .vm.$emit('ready', { expanded: true, pinned: true });
    await nextTick();

    expect(mobileWrapper.find('[data-testid="feed-drawer-resize-handle"]').exists()).toBe(false);
    localStorage.removeItem('ActivityBarCollapsed');
  });

  it('uses the active theme token for selected activity-bar controls', () => {
    expect(activityBarSource).toMatch(
      /\.activity-nav-button\[data-active='true'\]\s*\{[\s\S]*?color:\s*var\(--accent-text-color\);/
    );
  });

  it('uses a restrained 48px desktop rail without shrinking activity targets', () => {
    expect(activityBarSource).toMatch(
      /\.smart-activity-bar\s*\{[\s\S]*?width:\s*48px;[\s\S]*?min-width:\s*48px;/
    );
    expect(activityBarSource).toMatch(
      /\.activity-nav-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    expect(activityBarSource).toContain('activity-brand-mark');
    expect(activityBarSource).toContain('activity-divider');
    expect(activityBarSource).toMatch(
      /\.activity-brand-mark,\s*\.activity-divider\s*\{[\s\S]*?opacity:\s*0\.72;/
    );
    expect(activityBarSource).toMatch(
      /\.smart-activity-bar:hover \.activity-brand-mark,[\s\S]*?\.smart-activity-bar:focus-within \.activity-divider\s*\{[\s\S]*?opacity:\s*1;/
    );
    expect(activityBarSource).toMatch(
      /\.activity-nav-button:not\(\.is-active\) :deep\(svg\)\s*\{[\s\S]*?opacity:\s*0\.82;/
    );
  });

  it('allows category selection and expansion from the keyboard', async () => {
    const wrapper = mount(SidebarCategory, {
      props: {
        name: 'News',
        feeds: [feed],
        isOpen: true,
        isActive: false,
        currentFeedId: null,
        feedUnreadCounts: { 1: 2 },
      },
      global: { plugins: [i18n] },
    });
    wrappers.push(wrapper);

    const header = wrapper.find('.category-header');
    expect(header.attributes('role')).toBe('button');
    expect(header.attributes('tabindex')).toBe('0');
    expect(header.attributes('aria-expanded')).toBe('true');

    await header.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('selectCategory')).toHaveLength(1);
  });

  it('keeps unread counts on feeds, not subscription group headers', () => {
    const wrapper = mount(SidebarCategory, {
      props: {
        name: 'News',
        feeds: [feed],
        isOpen: true,
        isActive: false,
        currentFeedId: null,
        feedUnreadCounts: { 1: 2 },
      },
      global: { plugins: [i18n] },
    });
    wrappers.push(wrapper);

    expect(wrapper.find('.category-header .unread-badge').exists()).toBe(false);
    expect(wrapper.get('.feed-item .unread-badge').text()).toBe('2');
    expect(sidebarCategorySource).not.toContain('unreadCount: number;');
    expect(sidebarCategorySource).not.toContain('v-if="unreadCount > 0"');
    expect(feedListSource).not.toContain(':unread-count="categoryUnreadCounts');
  });

  it('renders feed unread counts as subdued text rather than filled badges', () => {
    expect(sidebarFeedSource).toMatch(
      /\.unread-badge\s*\{[\s\S]*?color:\s*var\(--text-secondary\);[\s\S]*?font-variant-numeric:\s*tabular-nums;/
    );
    expect(sidebarFeedSource).not.toMatch(
      /\.unread-badge\s*\{[\s\S]*?background-color:\s*var\(--unread-badge-background\);/
    );
    expect(sidebarFeedSource).not.toContain('opacity: 0.78');
    expect(sidebarFeedSource).toMatch(
      /\.feed-item:hover \.unread-badge,[\s\S]*?\.feed-item\.active \.unread-badge\s*\{[\s\S]*?color:\s*currentColor;/
    );
  });

  it('allows feed selection from the keyboard and exposes current state', async () => {
    const wrapper = mount(SidebarFeed, {
      props: {
        feed,
        isActive: true,
        unreadCount: 1,
      },
      global: { plugins: [i18n] },
    });
    wrappers.push(wrapper);

    const item = wrapper.find('.feed-item');
    expect(item.attributes('role')).toBe('button');
    expect(item.attributes('tabindex')).toBe('0');
    expect(item.attributes('aria-current')).toBe('page');

    await item.trigger('keydown', { key: ' ' });
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('keeps sidebar rows and drawer controls touchable on mobile', () => {
    expect(sidebarFeedSource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.feed-item\s*\{[\s\S]*?min-height:\s*44px;/
    );
    expect(sidebarCategorySource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.category-header\s*\{[\s\S]*?min-height:\s*44px;/
    );
    expect((feedListSource.match(/ui-icon-button/g) || []).length).toBeGreaterThanOrEqual(5);
    ['toggle-pin', 'close-drawer', 'clear-search', 'toggle-edit', 'save-filter'].forEach(
      (action) => {
        expect(feedListSource).toContain(`data-action="${action}"`);
      }
    );
  });

  it('keeps touch targets at 44px throughout the 640–767px mobile range', () => {
    expect(feedListSource).toContain('ui-icon-button ui-button--ghost');
    expect(savedFilterSource).toContain('min-h-11 md:min-h-0');
    expect(savedFilterSource).toContain('ui-icon-button ui-button--ghost');
    expect(savedFilterSource).toContain('ui-icon-button ui-icon-button--danger');
    expect(sidebarCategorySource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.category-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    expect(sidebarSource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.compact-sidebar-wrapper\.width-auto-hidden \.sidebar-toggle-container\s*\{[\s\S]*?width:\s*44px;/
    );
    expect(sidebarSource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.edge-pin-button\s*\{[\s\S]*?width:\s*44px;/
    );
  });

  it('separates auto-hide preview from the action that fixes the desktop rail visible', () => {
    expect(sidebarSource).toMatch(/import \{[^}]*\btoRef\b[^}]*\} from 'vue';/);
    expect(sidebarSource).toContain(
      "import { useSidebarEdgeReveal } from '@/composables/ui/useSidebarEdgeReveal';"
    );
    expect(sidebarSource).toMatch(
      /useSidebarEdgeReveal\(\{\s*isAutoHideEnabled:\s*isActivityBarAutoHideEnabled,\s*isMobile:\s*toRef\(props, 'isMobile'\),\s*}\)/
    );
    expect(sidebarSource).toContain(
      "return isActivityBarAutoHideEnabled.value ? 'pin' : 'auto-hide';"
    );
    expect(sidebarSource).toContain("'is-edge-revealed': isTemporarilyRevealed");
    expect(sidebarSource).toContain("'width-auto-hidden': isActivityBarAutoHideEnabled");
    expect(sidebarSource).toMatch(
      /<div\s+ref="sidebarToggleContainerRef"\s+class="sidebar-toggle-container"[\s\S]*?@pointerenter="handlePointerEnter"[\s\S]*?@pointerleave="handlePointerLeave"[\s\S]*?@focusin="handleFocusIn"[\s\S]*?@focusout="handleFocusOut"/
    );
    expect(sidebarSource).toContain(':is-collapsed="!isActivityBarVisible"');
    expect(sidebarSource).toMatch(
      /v-if="!props\.isMobile && isActivityBarAutoHideEnabled"\s+ref="desktopRevealBridgeRef"\s+type="button"\s+class="sidebar-reveal-bridge"[\s\S]*?:aria-label="t\('sidebar\.activity\.showActivityBar'\)"[\s\S]*?@click="focusDesktopPreview"/
    );
    expect(sidebarSource).toMatch(
      /v-if="props\.isMobile && isActivityBarAutoHideEnabled"\s+ref="mobileEdgeToggleRef"\s+type="button"\s+data-testid="sidebar-edge-toggle"[\s\S]*?:title="t\('sidebar\.activity\.expandActivityBar'\)"\s+:aria-label="t\('sidebar\.activity\.expandActivityBar'\)"\s+:aria-expanded="isActivityBarVisible"[\s\S]*?@click="expandMobileActivityBar"/
    );
    expect(sidebarSource).toMatch(
      /function pinActivityBar\(\): void \{\s*dismissTemporaryReveal\(\);\s*isActivityBarAutoHideEnabled\.value = false;\s*saveActivityBarAutoHideState\(\);\s*}/
    );
    expect(sidebarSource).toMatch(
      /function expandMobileActivityBar\(event: MouseEvent\)[\s\S]*?nextTick\(focusFirstActivityBarAction\);/
    );
    expect(sidebarSource).toMatch(
      /function focusFirstActivityBarAction\(\): void \{[\s\S]*?sidebarToggleContainerRef\.value[\s\S]*?\.focus\(\);/
    );
    expect(sidebarSource).toMatch(
      /function hideActivityBar\(event\?: MouseEvent\): void \{\s*const shouldRestoreKeyboardFocus = event\?\.detail === 0;\s*dismissTemporaryReveal\(\);\s*isActivityBarAutoHideEnabled\.value = true;\s*saveActivityBarAutoHideState\(\);\s*if \(shouldRestoreKeyboardFocus\) \{\s*nextTick\(focusActivityBarRevealControl\);\s*}\s*}/
    );
    expect(sidebarSource).toContain(':visibility-control="activityBarVisibilityControl"');
    expect(sidebarSource).toContain('@hide-activity-bar="hideActivityBar"');
    expect(sidebarSource).toContain('@pin-activity-bar="pinActivityBar"');
    expect(sidebarSource).toMatch(
      /\.compact-sidebar-wrapper\.is-edge-revealed \.sidebar-toggle-container\s*\{\s*z-index:\s*32;/
    );
    expect(sidebarSource).toMatch(
      /\.sidebar-toggle-container\s*\{[\s\S]*?width:\s*48px;[\s\S]*?min-width:\s*48px;/
    );
    expect(sidebarSource).toContain('class="sidebar-reveal-bridge"');
    expect(sidebarSource).toMatch(/\.sidebar-reveal-bridge\s*\{[\s\S]*?pointer-events:\s*none;/);
    expect(sidebarSource).toMatch(
      /\.compact-sidebar-wrapper\.is-edge-revealed \.sidebar-reveal-bridge\s*\{[\s\S]*?width:\s*48px;[\s\S]*?pointer-events:\s*auto;/
    );
    expect(sidebarSource).not.toContain('margin-right: -32px;');
    expect(sidebarSource).toContain("{ 'activity-bar-auto-hidden': isActivityBarAutoHideEnabled }");
    expect(sidebarSource).not.toContain("{ 'activity-bar-collapsed': !isActivityBarVisible }");
    expect(sidebarSource).toMatch(
      /\.feed-drawer-wrapper:not\(\.pinned\)\s*\{[\s\S]*?left:\s*48px;/
    );
    expect(activityBarSource).toContain("'auto-hide' | 'pin' | 'collapse'");
    expect(activityBarSource).toContain("emit('pin-activity-bar')");
    expect(activityBarSource).toContain("emit('hide-activity-bar', event)");
  });

  it('keeps saved filters at a mobile-friendly minimum height', () => {
    const wrapper = mount(SavedFilterItem, {
      props: { filter: savedFilter, isActive: false },
      global: { plugins: [i18n] },
    });
    wrappers.push(wrapper);

    expect(wrapper.get('[role="button"]').classes()).toContain('min-h-11');
  });

  it('uses contrast-checked sidebar surfaces for drawer and saved-filter states', () => {
    expect(feedListSource).toContain('ui-button--ghost');
    expect(feedListSource).toContain('saved-filters-header');
    expect(feedListSource).toMatch(
      /\.reader-feed-drawer\.is-pinned\s*\{[\s\S]*?background-color:\s*var\(--bg-primary\);/
    );
    expect(sidebarFeedSource).toContain('sidebar-error-tooltip');
    expect(savedFilterSource).toMatch(
      /\.saved-filter-item:hover\s*\{[\s\S]*?background-color:\s*var\(--surface-hover\);/
    );
    expect(savedFilterSource).toMatch(
      /\.saved-filter-item\.is-active[\s\S]*?background-color:\s*var\(--surface-selected\);/
    );
    expect(sidebarCategorySource).not.toContain('hover:bg-bg-tertiary');
    expect(sidebarFeedSource).not.toContain('hover:bg-bg-tertiary');
    expect(sidebarCategorySource).toContain('hover:text-accent-text');
    expect(sidebarFeedSource).toMatch(
      /\.feed-item:hover\s*\{[\s\S]*?color:\s*var\(--accent-text-color\);/
    );
    expect(savedFilterSource).toMatch(
      /\.saved-filter-item:hover\s*\{[\s\S]*?color:\s*var\(--accent-text-color\);/
    );
    expect(sidebarCategorySource).toContain(
      "isActive ? 'text-accent-text' : 'text-text-secondary'"
    );
    expect(sidebarFeedSource).toContain("isActive ? 'text-accent-text' : 'text-text-secondary'");
    expect(sidebarFeedSource).toMatch(
      /\.feed-item\.active \.drag-handle,[\s\S]*?color:\s*var\(--accent-text-color\);/
    );
  });
});
