import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import ArticleSummary from './ArticleSummary.vue';

let wrapper: VueWrapper | undefined;

describe('ArticleSummary links', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('leaves summary links to native navigation instead of opening the default browser', async () => {
    wrapper = mount(ArticleSummary, {
      attachTo: document.body,
      props: {
        summaryResult: {
          summary: 'Read the reference',
          html: '<p>Read the <a href="https://example.com/reference">reference</a></p>',
          sentence_count: 1,
          is_too_short: false,
        },
        isLoadingSummary: false,
        translationEnabled: false,
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    });
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockClear();

    const link = wrapper.get('.summary-display a').element;
    let wasPreventedBeforeNativeNavigation = true;
    wrapper.element.addEventListener('click', (event) => {
      wasPreventedBeforeNativeNavigation = event.defaultPrevented;
      event.preventDefault();
    });

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(wasPreventedBeforeNativeNavigation).toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/browser/open')).toBe(
      false
    );
  });
});
