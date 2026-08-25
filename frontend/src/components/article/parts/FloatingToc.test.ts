import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import FloatingToc from './FloatingToc.vue';

let wrapper: VueWrapper | undefined;
let scrollContainer: HTMLElement | undefined;

function mockViewport(isDesktop: boolean): void {
  window.matchMedia = vi.fn(() => ({
    matches: isDesktop,
    media: '(min-width: 768px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function createScrollContainer(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <article class="prose-content">
      <h2>First section</h2>
      <p>Body</p>
      <h2>Second section</h2>
      <p>More body</p>
    </article>
  `;
  Object.defineProperties(container, {
    clientHeight: { configurable: true, value: 300 },
    scrollHeight: { configurable: true, value: 900 },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
  container.scrollTo = vi.fn();
  container.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 300, bottom: 300, width: 300, height: 300 }) as DOMRect;
  container.querySelectorAll<HTMLElement>('h2').forEach((heading, index) => {
    heading.getBoundingClientRect = () =>
      ({
        top: 120 + index * 240,
        left: 0,
        right: 280,
        bottom: 156,
        width: 280,
        height: 36,
      }) as DOMRect;
  });
  document.body.append(container);
  return container;
}

async function mountToc(options: { isDesktop: boolean; expanded?: boolean }) {
  mockViewport(options.isDesktop);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  scrollContainer = createScrollContainer();
  wrapper = mount(FloatingToc, {
    attachTo: document.body,
    props: {
      articleId: 42,
      enabled: true,
      expanded: options.expanded ?? false,
      scrollContainer,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
  await nextTick();
  await nextTick();
  return wrapper;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  scrollContainer?.remove();
  scrollContainer = undefined;
  vi.restoreAllMocks();
});

describe('FloatingToc', () => {
  it('opens the same heading list in a mobile contents sheet and closes after selection', async () => {
    await mountToc({ isDesktop: false, expanded: true });

    const sheet = document.body.querySelector<HTMLElement>('[data-testid="reader-contents-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.querySelector('[role="dialog"]')).not.toBeNull();

    const firstItem = document.body.querySelector<HTMLButtonElement>('[data-testid="toc-item-0"]');
    expect(firstItem?.textContent).toContain('First section');
    firstItem?.click();
    await nextTick();

    expect(scrollContainer?.scrollTo).toHaveBeenCalledWith({ top: 108, behavior: 'smooth' });
    expect(wrapper?.emitted('select')).toEqual([
      [expect.objectContaining({ text: 'First section' })],
    ]);
    expect(wrapper?.emitted('close')).toEqual([[false]]);
    const selectedHeading = scrollContainer?.querySelector<HTMLElement>('h2');
    expect(selectedHeading?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(selectedHeading);
  });

  it('reveals desktop heading labels when the reader explicitly opens contents', async () => {
    const toc = await mountToc({ isDesktop: true, expanded: true });

    expect(toc.get('[data-testid="reader-contents-desktop"]').classes()).toContain(
      'reader-contents-desktop--expanded'
    );
    expect(toc.get('[data-testid="toc-item-0"]').text()).toContain('First section');
  });

  it('keeps a single current section reachable in the collapsed desktop rail', async () => {
    const toc = await mountToc({ isDesktop: true, expanded: false });

    expect(toc.get('[data-testid="toc-item-0"]').attributes('tabindex')).toBe('0');
    expect(toc.get('[data-testid="toc-item-1"]').attributes('tabindex')).toBe('-1');
  });
});
