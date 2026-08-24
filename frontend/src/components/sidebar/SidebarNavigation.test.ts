import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import en from '@/i18n/locales/en';
import ActivityBar from './ActivityBar.vue';
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

  it('uses the active theme token for selected activity-bar controls', () => {
    expect(activityBarSource).toMatch(
      /\.activity-nav-button\[data-active='true'\]\s*\{[\s\S]*?color:\s*var\(--accent-text-color\);/
    );
  });

  it('allows category selection and expansion from the keyboard', async () => {
    const wrapper = mount(SidebarCategory, {
      props: {
        name: 'News',
        feeds: [feed],
        isOpen: true,
        isActive: false,
        unreadCount: 2,
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
    expect(feedListSource).toMatch(
      /\.drawer-icon-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    ['toggle-pin', 'close-drawer', 'clear-search', 'toggle-edit', 'save-filter'].forEach(
      (action) => {
        expect(feedListSource).toContain(`data-action="${action}"`);
      }
    );
  });

  it('keeps touch targets at 44px throughout the 640–767px mobile range', () => {
    expect(feedListSource).toMatch(
      /@media \(min-width: 768px\)\s*\{[\s\S]*?\.drawer-icon-button\s*\{[\s\S]*?width:\s*36px;/
    );
    expect(savedFilterSource).toContain('min-h-11 md:min-h-0');
    expect(savedFilterSource).toContain('min-h-11 min-w-11 md:min-h-8 md:min-w-8');
    expect(sidebarCategorySource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.category-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    expect(sidebarSource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.compact-sidebar-wrapper\.width-collapsed \.sidebar-toggle-container\s*\{[\s\S]*?width:\s*44px;/
    );
    expect(sidebarSource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.edge-toggle-button\s*\{[\s\S]*?width:\s*44px;/
    );
  });

  it('reveals a collapsed desktop rail transiently without moving its feed drawer', () => {
    expect(sidebarSource).toMatch(/import \{[^}]*\btoRef\b[^}]*\} from 'vue';/);
    expect(sidebarSource).toContain(
      "import { useSidebarEdgeReveal } from '@/composables/ui/useSidebarEdgeReveal';"
    );
    expect(sidebarSource).toMatch(
      /useSidebarEdgeReveal\(\{\s*isPersistentlyCollapsed:\s*isActivityBarCollapsed,\s*isMobile:\s*toRef\(props, 'isMobile'\),\s*}\)/
    );
    expect(sidebarSource).toContain("'is-edge-revealed': isTemporarilyRevealed");
    expect(sidebarSource).toMatch(
      /<div\s+class="sidebar-toggle-container"\s+@pointerenter="handlePointerEnter"\s+@pointerleave="handlePointerLeave"\s+@focusin="handleFocusIn"\s+@focusout="handleFocusOut"\s*>/
    );
    expect(sidebarSource).toContain(':is-collapsed="!isActivityBarVisible"');
    expect(sidebarSource).toMatch(
      /v-if="isActivityBarCollapsed"\s+type="button"\s+data-testid="sidebar-edge-toggle"[\s\S]*?:aria-expanded="isActivityBarVisible"[\s\S]*?@click="persistExpandedFromEdge"/
    );
    expect(sidebarSource).toMatch(
      /function persistExpandedFromEdge\(\) \{\s*dismissTemporaryReveal\(\);\s*isActivityBarCollapsed\.value = false;\s*saveActivityBarState\(\);\s*}/
    );
    expect(sidebarSource).toMatch(
      /function toggleActivityBar\(\) \{\s*if \(isActivityBarCollapsed\.value\) \{\s*dismissTemporaryReveal\(\);\s*return;\s*}\s*isActivityBarCollapsed\.value = true;\s*saveActivityBarState\(\);\s*}/
    );
    expect(sidebarSource).toMatch(
      /\.compact-sidebar-wrapper\.is-edge-revealed \.sidebar-toggle-container\s*\{\s*z-index:\s*32;/
    );
    expect(sidebarSource).toMatch(
      /@media \(min-width: 1401px\)\s*\{\s*\.compact-sidebar-wrapper\.width-collapsed\.is-edge-revealed \.sidebar-toggle-container\s*\{[\s\S]*?width:\s*56px;[\s\S]*?min-width:\s*56px;[\s\S]*?margin-right:\s*-40px;/
    );
    expect(sidebarSource).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1400px\)\s*\{\s*\.compact-sidebar-wrapper\.width-collapsed\.is-edge-revealed \.sidebar-toggle-container\s*\{[\s\S]*?width:\s*48px;[\s\S]*?min-width:\s*48px;[\s\S]*?margin-right:\s*-32px;/
    );
    expect(sidebarSource).toMatch(
      /\.compact-sidebar-wrapper\.is-edge-revealed \.edge-toggle-button\s*\{\s*z-index:\s*31;/
    );
    expect(sidebarSource).toContain("{ 'activity-bar-collapsed': isActivityBarCollapsed }");
    expect(sidebarSource).not.toContain("{ 'activity-bar-collapsed': !isActivityBarVisible }");
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
    expect(feedListSource).toMatch(
      /\.drawer-icon-button:hover:not\(:disabled\)\s*\{[\s\S]*?background-color:\s*var\(--surface-hover\);/
    );
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
