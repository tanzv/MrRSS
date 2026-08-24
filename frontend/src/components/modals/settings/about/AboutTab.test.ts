import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en';
import { openInBrowser } from '@/utils/browser';
import AboutTab from './AboutTab.vue';

vi.mock('@/utils/browser', () => ({
  openInBrowser: vi.fn(),
}));

const currentRepositoryURL = 'https://github.com/tanzv/MrRSS';
const latestReleaseURL = `${currentRepositoryURL}/releases/latest`;

function mountAboutTab(
  updateInfo: {
    has_update: boolean;
    current_version: string;
    latest_version: string;
    download_url?: string;
  } | null = null
) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '1.3.26' }),
    })
  );

  return mount(AboutTab, {
    props: { updateInfo },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('AboutTab repository links', () => {
  it('opens the current repository from the persistent GitHub link', async () => {
    const wrapper = mountAboutTab();
    await flushPromises();

    await wrapper.get('[data-testid="about-repository-link"]').trigger('click');

    expect(openInBrowser).toHaveBeenCalledWith(currentRepositoryURL);
  });

  it('opens the current latest-release page when an installer is unavailable', async () => {
    const wrapper = mountAboutTab({
      has_update: true,
      current_version: '1.3.25',
      latest_version: '1.3.26',
    });
    await flushPromises();

    await wrapper.get('[data-testid="about-manual-update-link"]').trigger('click');

    expect(openInBrowser).toHaveBeenCalledWith(latestReleaseURL);
  });
});
