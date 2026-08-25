<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhArrowLineUp, PhX } from '@phosphor-icons/vue';
import {
  buildTocItems,
  calcTocProgress,
  shouldShowTocText,
  type TocItem,
  type HeadingSnapshot,
} from '@/composables/article/floatingToc';

interface Props {
  articleId: number;
  enabled: boolean;
  scrollContainer: HTMLElement | null;
  expanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false,
});
const emit = defineEmits<{
  close: [restoreFocus?: boolean];
  select: [item: TocItem];
}>();
const { t } = useI18n();

const tocItems = ref<TocItem[]>([]);
const tocListEl = ref<HTMLElement | null>(null);
const mobileSheetRef = ref<HTMLElement | null>(null);
const activeIndex = ref(-1);
const sectionProgress = ref(0);
const articleProgress = ref(0);
const isDesktop = ref(false);
const hasVisibleItems = computed(() => tocItems.value.some((item) => !item.isFallback));
const isMobileSheetOpen = computed(() => props.enabled && props.expanded && !isDesktop.value);

let mediaQuery: ReturnType<typeof window.matchMedia> | null = null;
let containerObserver: InstanceType<typeof window.MutationObserver> | null = null;
let pendingProseObserver: InstanceType<typeof window.MutationObserver> | null = null;
let scrollContainerEl: HTMLElement | null = null;
let rebuildRaf: number | null = null;
let scrollRaf: number | null = null;
let lastAutoScrolledIndex = -1;

function shouldShowText(itemIndex: number): boolean {
  return props.expanded || shouldShowTocText(itemIndex, activeIndex.value, tocItems.value);
}

function isTocItemFocusable(itemIndex: number): boolean {
  if (props.expanded) return true;

  const currentIndex = activeIndex.value >= 0 ? activeIndex.value : 0;
  return itemIndex === currentIndex;
}

function queueRebuild(): void {
  if (rebuildRaf !== null) {
    window.cancelAnimationFrame(rebuildRaf);
  }
  rebuildRaf = window.requestAnimationFrame(() => {
    rebuildRaf = null;
    buildToc();
  });
}

function queueScrollSync(): void {
  if (scrollRaf !== null) return;
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = null;
    updateActiveSection();
  });
}

function getMarkerFillPercent(index: number): number {
  if (index !== activeIndex.value) return 0;
  return sectionProgress.value;
}

function shouldReduceMotion(): boolean {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function autoScrollTocToActive(index: number): void {
  const list = tocListEl.value;
  if (!list || index < 0 || shouldReduceMotion()) return;
  if (list.scrollHeight <= list.clientHeight + 1) return;

  const item = list.querySelector<HTMLElement>(`[data-toc-index="${index}"]`);
  if (!item) return;

  const itemTop = item.offsetTop;
  const targetTop = itemTop - (list.clientHeight - item.offsetHeight) / 2;
  const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
  const nextTop = Math.max(0, Math.min(targetTop, maxTop));
  const delta = Math.abs(nextTop - list.scrollTop);
  if (delta < 6) return;

  list.scrollTo({ top: nextTop, behavior: 'smooth' });
}

function clearToc(): void {
  tocItems.value = [];
  activeIndex.value = -1;
  sectionProgress.value = 0;
  articleProgress.value = 0;
}

function buildToc(): void {
  const container = props.scrollContainer;
  if (!props.enabled || !container) {
    clearToc();
    return;
  }

  const proseContainer = container.querySelector('.prose-content');
  if (!proseContainer) {
    tocItems.value = [];
    activeIndex.value = -1;
    sectionProgress.value = 0;
    articleProgress.value = calcTocProgress(
      container.scrollTop,
      container.scrollHeight,
      container.clientHeight,
      []
    ).articleProgress;
    return;
  }

  const headings = Array.from(proseContainer.querySelectorAll<HTMLElement>('h1, h2, h3'));
  const containerRect = container.getBoundingClientRect();
  const articleId = props.articleId || 0;
  const snapshots: HeadingSnapshot[] = headings
    .map((heading, index) => {
      const level = Number(heading.tagName.slice(1));
      if (level < 1 || level > 3) return null;

      const translationEl = heading.nextElementSibling as HTMLElement | null;
      const hasHeadingTranslation =
        translationEl &&
        translationEl.classList.contains('translation-text') &&
        !translationEl.classList.contains('translation-inline') &&
        !translationEl.classList.contains('translation-blockquote');

      return {
        level: level as 1 | 2 | 3,
        offsetTop: heading.getBoundingClientRect().top - containerRect.top + container.scrollTop,
        rawText: heading.textContent || '',
        translatedText: hasHeadingTranslation ? translationEl.textContent || '' : '',
        existingId: heading.id || undefined,
        domIndex: index,
      };
    })
    .filter((item): item is HeadingSnapshot => item !== null);

  const { items, generatedIds } = buildTocItems(snapshots, articleId);
  generatedIds.forEach(({ domIndex, id }) => {
    if (headings[domIndex]) {
      headings[domIndex].id = id;
    }
  });

  tocItems.value = items;
  updateActiveSection();
}

function updateActiveSection(): void {
  const container = props.scrollContainer;
  const items = tocItems.value;

  if (!container || items.length === 0) {
    activeIndex.value = -1;
    sectionProgress.value = 0;
    articleProgress.value = container
      ? calcTocProgress(container.scrollTop, container.scrollHeight, container.clientHeight, [])
          .articleProgress
      : 0;
    lastAutoScrolledIndex = -1;
    return;
  }

  const progress = calcTocProgress(
    container.scrollTop,
    container.scrollHeight,
    container.clientHeight,
    items
  );
  articleProgress.value = progress.articleProgress;
  activeIndex.value = progress.activeIndex;
  sectionProgress.value = progress.sectionProgress;

  if (progress.activeIndex !== lastAutoScrolledIndex) {
    autoScrollTocToActive(progress.activeIndex);
    lastAutoScrolledIndex = progress.activeIndex;
  }
}

function scrollToHeading(item: TocItem): void {
  const container = props.scrollContainer;
  if (!container || item.isFallback) return;

  const targetTop = Math.max(0, item.offsetTop - 12);
  container.scrollTo({
    top: targetTop,
    behavior: shouldReduceMotion() ? 'auto' : 'smooth',
  });
  const target = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3')).find(
    (heading) => heading.id === item.id
  );
  if (target) {
    target.setAttribute('tabindex', '-1');
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }
  emit('select', item);
  emit('close', false);
}

function scrollToTop(): void {
  const container = props.scrollContainer;
  if (!container) return;

  container.scrollTo({ top: 0, behavior: shouldReduceMotion() ? 'auto' : 'smooth' });
}

function getMobileSheetFocusableElements(): HTMLElement[] {
  if (!mobileSheetRef.value) return [];

  return Array.from(
    mobileSheetRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function focusFirstMobileSheetControl(): void {
  getMobileSheetFocusableElements()[0]?.focus({ preventScroll: true });
}

function handleMobileSheetKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;

  const focusable = getMobileSheetFocusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

  if (event.shiftKey && (currentIndex <= 0 || document.activeElement === first)) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && (currentIndex === -1 || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}

function handleMobileSheetOverlayClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    emit('close');
  }
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (!isMobileSheetOpen.value || event.key !== 'Escape') return;

  event.preventDefault();
  event.stopImmediatePropagation();
  emit('close');
}

function handleMediaChange(event: Event): void {
  const mediaEvent = event as Event & { matches?: boolean };
  isDesktop.value = Boolean(mediaEvent.matches);
  queueRebuild();
}

function bindScrollContainer(container: HTMLElement | null): void {
  if (scrollContainerEl) {
    scrollContainerEl.removeEventListener('scroll', queueScrollSync);
  }

  scrollContainerEl = container;

  if (scrollContainerEl) {
    scrollContainerEl.addEventListener('scroll', queueScrollSync, { passive: true });
  }
}

function connectContainerObserver(): void {
  containerObserver?.disconnect();
  pendingProseObserver?.disconnect();
  containerObserver = null;
  pendingProseObserver = null;

  const container = props.scrollContainer;
  if (!container) return;

  const proseContainer = container.querySelector('.prose-content');
  if (!proseContainer) {
    pendingProseObserver = new window.MutationObserver(() => {
      const readyProse = container.querySelector('.prose-content');
      if (!readyProse) return;

      pendingProseObserver?.disconnect();
      pendingProseObserver = null;
      connectContainerObserver();
      queueRebuild();
    });

    pendingProseObserver.observe(container, { childList: true, subtree: true });
    return;
  }

  containerObserver = new window.MutationObserver(() => queueRebuild());
  containerObserver.observe(proseContainer, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

onMounted(async () => {
  mediaQuery = window.matchMedia('(min-width: 768px)');
  isDesktop.value = mediaQuery.matches;

  mediaQuery.addEventListener('change', handleMediaChange);
  window.addEventListener('resize', queueRebuild);
  window.addEventListener('keydown', handleWindowKeydown, true);

  await nextTick();
  bindScrollContainer(props.scrollContainer);
  connectContainerObserver();
  queueRebuild();
});

watch(
  () => [props.articleId, props.enabled] as const,
  async () => {
    await nextTick();
    bindScrollContainer(props.scrollContainer);
    connectContainerObserver();
    queueRebuild();
  }
);

watch(
  () => props.scrollContainer,
  async (container) => {
    await nextTick();
    bindScrollContainer(container);
    connectContainerObserver();
    queueRebuild();
  }
);

watch(isMobileSheetOpen, (isOpen) => {
  if (isOpen) {
    void nextTick(focusFirstMobileSheetControl);
  }
});

onBeforeUnmount(() => {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', handleMediaChange);
  }

  window.removeEventListener('resize', queueRebuild);
  window.removeEventListener('keydown', handleWindowKeydown, true);
  scrollContainerEl?.removeEventListener('scroll', queueScrollSync);
  containerObserver?.disconnect();
  pendingProseObserver?.disconnect();

  if (rebuildRaf !== null) {
    window.cancelAnimationFrame(rebuildRaf);
  }
  if (scrollRaf !== null) {
    window.cancelAnimationFrame(scrollRaf);
  }
});
</script>

<template>
  <div
    v-if="enabled && isDesktop && hasVisibleItems"
    id="reader-contents"
    data-testid="reader-contents-desktop"
    :class="[
      'pointer-events-none absolute right-[8px] top-[76px] bottom-6 z-40 flex w-[max(15%,125px)] flex-col items-end justify-center [container-type:inline-size]',
      { 'reader-contents-desktop--expanded': expanded },
    ]"
  >
    <div
      class="mb-2 flex w-full items-center justify-between gap-2 text-[10px] font-medium text-text-tertiary"
    >
      <span v-if="expanded">{{ t('article.readingMode.contents') }}</span>
      <span class="ml-auto tabular-nums">{{ articleProgress }}%</span>
    </div>

    <div class="group/toclist pointer-events-auto relative w-full max-h-[80%]">
      <div
        :class="[
          'pointer-events-none absolute -inset-y-1.5 -left-2 -right-1 rounded-lg border border-border bg-bg-secondary shadow-lg shadow-black/15 transition-all duration-200 dark:shadow-black/40',
          expanded
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-[0.98] group-hover/toclist:opacity-100 group-hover/toclist:scale-100',
        ]"
      ></div>

      <ul
        ref="tocListEl"
        class="toc-list-scroll relative z-[1] flex w-full max-h-full flex-col items-start gap-1 overflow-y-scroll [scrollbar-gutter:stable_both-edges]"
      >
        <li
          v-for="(item, index) in tocItems"
          :key="item.id"
          class="w-full"
          :data-level="item.level"
          :data-toc-index="index"
        >
          <button
            type="button"
            :data-testid="`toc-item-${index}`"
            class="group/item flex w-full cursor-pointer items-center justify-start gap-1 rounded py-0.5 transition-colors"
            :style="{ '--toc-level': String(item.level) }"
            :aria-current="index === activeIndex ? 'location' : undefined"
            :tabindex="isTocItemFocusable(index) ? 0 : -1"
            @click="scrollToHeading(item)"
          >
            <span
              :class="[
                'toc-text flex-1 min-w-0 truncate text-left text-xs opacity-0 transition-all duration-200 [margin-left:calc((var(--toc-level,1)-1)*12px)]',
                index === activeIndex ? 'text-text-primary' : 'text-text-secondary',
                shouldShowText(index) ? 'toc-text-visible opacity-[0.85] max-w-full' : 'max-w-0',
                !expanded &&
                  'group-hover/toclist:opacity-[0.85] group-hover/toclist:max-w-full group-hover/item:text-text-primary group-hover/item:opacity-100',
              ]"
              :data-level="item.level"
              :title="item.text"
            >
              {{ item.text }}
            </span>
            <span class="ml-auto flex w-[34px] shrink-0 justify-end">
              <span
                :class="[
                  'relative overflow-hidden bg-text-secondary transition-colors duration-150 group-hover/item:bg-text-primary',
                  index === activeIndex ? 'h-[3px] opacity-100' : 'h-[2px] opacity-70',
                ]"
                :style="{ width: `${item.markerWidth}px` }"
              >
                <span
                  class="absolute left-0 top-0 h-full bg-accent transition-all duration-150 group-hover/item:bg-text-primary"
                  :style="{ width: `${getMarkerFillPercent(index)}%` }"
                ></span>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <button
      type="button"
      class="pointer-events-auto mt-3 flex h-7 w-7 items-center justify-center self-end rounded bg-transparent text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_70%,transparent)] hover:text-text-primary"
      :title="t('article.readingMode.contentsTop')"
      :aria-label="t('article.readingMode.contentsTop')"
      @click="scrollToTop"
    >
      <PhArrowLineUp :size="14" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="isMobileSheetOpen"
      data-testid="reader-contents-sheet"
      class="reader-contents-sheet-host"
      @click="handleMobileSheetOverlayClick"
    >
      <section
        id="reader-contents"
        ref="mobileSheetRef"
        class="reader-contents-sheet"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'reader-contents-title'"
        @keydown="handleMobileSheetKeydown"
      >
        <header class="reader-contents-sheet-header app-panel-header">
          <h2 id="reader-contents-title" class="ui-page-title">
            {{ t('article.readingMode.contents') }}
          </h2>
          <button
            type="button"
            class="ui-icon-button ui-button--ghost"
            :aria-label="t('article.readingMode.contentsClose')"
            :title="t('article.readingMode.contentsClose')"
            @click="emit('close')"
          >
            <PhX :size="18" aria-hidden="true" />
          </button>
        </header>

        <div v-if="hasVisibleItems" class="reader-contents-sheet-list">
          <button
            v-for="(item, index) in tocItems.filter((item) => !item.isFallback)"
            :key="item.id"
            type="button"
            :data-testid="`toc-item-${index}`"
            class="reader-contents-sheet-item"
            :style="{ '--toc-level': String(item.level) }"
            :aria-current="index === activeIndex ? 'location' : undefined"
            @click="scrollToHeading(item)"
          >
            <span class="reader-contents-sheet-item-label">{{ item.text }}</span>
            <span v-if="index === activeIndex" class="reader-contents-sheet-current">
              {{ t('article.readingMode.contentsCurrent') }}
            </span>
          </button>
        </div>
        <p v-else class="reader-contents-sheet-empty">
          {{ t('article.readingMode.contentsEmpty') }}
        </p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.toc-list-scroll {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.group\/toclist:hover .toc-list-scroll,
.reader-contents-desktop--expanded .toc-list-scroll {
  scrollbar-color: var(--border-color) transparent;
}

.toc-list-scroll::-webkit-scrollbar {
  width: 6px;
}

.toc-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.toc-list-scroll::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

.group\/toclist:hover .toc-list-scroll::-webkit-scrollbar-thumb,
.reader-contents-desktop--expanded .toc-list-scroll::-webkit-scrollbar-thumb {
  background: var(--border-color);
}

.toc-list-scroll::-webkit-scrollbar-thumb:hover {
  background: transparent;
}

.group\/toclist:hover .toc-list-scroll::-webkit-scrollbar-thumb:hover,
.reader-contents-desktop--expanded .toc-list-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.reader-contents-sheet-host {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  background: var(--overlay-backdrop, rgb(0 0 0 / 0.42));
}

.reader-contents-sheet {
  width: 100%;
  max-height: min(38rem, calc(100dvh - 1rem));
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-bottom: 0;
  border-radius: 0.75rem 0.75rem 0 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.reader-contents-sheet-header {
  position: sticky;
  top: 0;
  z-index: 1;
}

.reader-contents-sheet-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
}

.reader-contents-sheet-item {
  display: flex;
  min-height: 44px;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  padding-left: calc(0.75rem + (var(--toc-level, 1) - 1) * 0.75rem);
  color: var(--text-primary);
  font-size: calc(0.9375rem * var(--ui-font-scale, 1));
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.reader-contents-sheet-item:hover,
.reader-contents-sheet-item:focus-visible {
  background: var(--bg-tertiary);
}

.reader-contents-sheet-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.reader-contents-sheet-item-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-contents-sheet-current {
  flex: 0 0 auto;
  color: var(--accent-text-color);
  font-size: calc(0.75rem * var(--ui-font-scale, 1));
}

.reader-contents-sheet-empty {
  margin: 0;
  padding: 1.5rem;
  color: var(--text-secondary);
  font-size: calc(0.875rem * var(--ui-font-scale, 1));
  text-align: center;
}

@container (max-width: 150px) {
  .toc-text-visible {
    opacity: 0;
    max-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reader-contents-sheet-item,
  .toc-text {
    transition: none;
  }
}
</style>
