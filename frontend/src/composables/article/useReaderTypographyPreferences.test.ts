import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { generateInitialSettings } from '@/composables/core/useSettings.generated';
import en from '@/i18n/locales/en';
import type { ReaderTypographyValues } from '@/utils/readerTypography';
import {
  useReaderTypographyPreferences,
  type ReaderTypographyPreferences,
  type ReaderTypographyPreferencesOptions,
} from './useReaderTypographyPreferences';

const magazineValues: ReaderTypographyValues = {
  content_font_family: 'serif',
  content_font_size: 17,
  content_line_height: '1.7',
  content_width: 'comfortable',
  content_paragraph_spacing: 'comfortable',
};

function mountPreferences(options: ReaderTypographyPreferencesOptions = {}) {
  const settings = options.settings ?? ref({ ...generateInitialSettings() });
  let preferences!: ReaderTypographyPreferences;
  const wrapper = mount(
    defineComponent({
      setup() {
        preferences = useReaderTypographyPreferences({ ...options, settings });
        return () => h('div');
      },
    }),
    {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      },
    }
  );

  return { wrapper, preferences, settings };
}

describe('useReaderTypographyPreferences', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('updates shared typography synchronously and saves one complete payload after the debounce', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValue({ ok: true } as Response);
    const { wrapper, preferences, settings } = mountPreferences({ request, debounceMs: 500 });
    const settingsUpdated = vi.fn();
    window.addEventListener('settings-updated', settingsUpdated);

    preferences.updateTypography({ content_font_size: 19 });
    preferences.updateTypography({ content_width: 'narrow' });

    expect(settings.value.content_font_size).toBe(19);
    expect(settings.value.content_width).toBe('narrow');
    await vi.advanceTimersByTimeAsync(499);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ content_font_size: '19', content_width: 'narrow' })
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(settingsUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { autoSave: true } })
    );

    window.removeEventListener('settings-updated', settingsUpdated);
    wrapper.unmount();
  });

  it('keeps the preview after a failed flush and exposes a retry that clears the error', async () => {
    const showToast = vi.spyOn(window, 'showToast');
    const request = vi
      .fn()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    const { wrapper, preferences, settings } = mountPreferences({ request, debounceMs: 500 });

    preferences.applyPreset(magazineValues);
    await preferences.flushSave();

    expect(settings.value).toMatchObject(magazineValues);
    expect(preferences.saveError.value).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Could not save reading appearance', 'error');

    await preferences.retrySave();

    expect(preferences.saveError.value).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('persists an update made while a save is in flight with a later request', async () => {
    vi.useFakeTimers();
    let finishFirstRequest!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => {
      finishFirstRequest = resolve;
    });
    const request = vi.fn().mockReturnValueOnce(firstRequest).mockResolvedValueOnce({ ok: true });
    const { wrapper, preferences } = mountPreferences({ request, debounceMs: 500 });

    preferences.updateTypography({ content_font_size: 18 });
    const flush = preferences.flushSave();
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);

    preferences.updateTypography({ content_width: 'wide' });
    finishFirstRequest({ ok: true } as Response);
    await flush;
    await vi.advanceTimersByTimeAsync(500);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ content_font_size: '18', content_width: 'wide' })
    );

    wrapper.unmount();
  });

  it('applies the current theme recommendation only when the restore command is invoked', () => {
    const { wrapper, preferences, settings } = mountPreferences({ debounceMs: 500 });

    preferences.applyThemeRecommendation('sepia');

    expect(settings.value).toMatchObject({
      content_font_family: 'serif',
      content_font_size: 18,
      content_line_height: '1.8',
      content_width: 'narrow',
      content_paragraph_spacing: 'relaxed',
    });

    wrapper.unmount();
  });
});
