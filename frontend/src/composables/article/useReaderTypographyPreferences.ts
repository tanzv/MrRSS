import { onUnmounted, readonly, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SettingsData } from '@/types/settings';
import type { ReaderCanvasValues } from '@/utils/readerCanvas';
import {
  getDefaultReaderTypographyPreset,
  type ReaderTypographyValues,
} from '@/utils/readerTypography';
import { buildAutoSavePayload } from '@/composables/core/useSettings.generated';
import { useSettings } from '@/composables/core/useSettings';

export type ReaderAppearanceSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface ReaderTypographyPreferences {
  settings: Ref<SettingsData>;
  isSaving: Readonly<Ref<boolean>>;
  saveError: Readonly<Ref<boolean>>;
  saveState: Readonly<Ref<ReaderAppearanceSaveState>>;
  updateTypography: (patch: Partial<ReaderTypographyValues>) => void;
  updateCanvas: (values: ReaderCanvasValues) => void;
  applyPreset: (values: ReaderTypographyValues) => void;
  restoreDefaultTypography: () => void;
  flushSave: () => Promise<void>;
  retrySave: () => Promise<void>;
}

export interface ReaderTypographyPreferencesOptions {
  settings?: Ref<SettingsData>;
  debounceMs?: number;
  request?: (payload: Record<string, string>) => Promise<Response>;
}

function defaultRequest(payload: Record<string, string>): Promise<Response> {
  return fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function useReaderTypographyPreferences(
  options: ReaderTypographyPreferencesOptions = {}
): ReaderTypographyPreferences {
  const { t } = useI18n();
  const settings = options.settings ?? useSettings().settings;
  const debounceMs = options.debounceMs ?? 500;
  const request = options.request ?? defaultRequest;
  const isSaving = ref(false);
  const saveError = ref(false);
  const saveState = ref<ReaderAppearanceSaveState>('idle');
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveInFlight: Promise<void> | null = null;
  let isDirty = false;

  function clearSaveTimer(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function scheduleSave(): void {
    clearSaveTimer();
    saveState.value = 'pending';
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void flushSave();
    }, debounceMs);
  }

  async function savePendingChanges(): Promise<void> {
    if (saveInFlight) {
      return saveInFlight;
    }

    saveInFlight = (async () => {
      isSaving.value = true;
      saveState.value = 'saving';

      while (isDirty) {
        isDirty = false;

        try {
          const response = await request(buildAutoSavePayload(settings));

          if (!response.ok) {
            throw new Error(`Settings request failed with status ${response.status}`);
          }

          saveError.value = false;
          window.dispatchEvent(new CustomEvent('settings-updated', { detail: { autoSave: true } }));
        } catch (error) {
          isDirty = true;
          saveError.value = true;
          saveState.value = 'error';
          console.error('Failed to save reading appearance:', error);
          window.showToast(t('article.readingMode.appearanceSaveFailed'), 'error');
          break;
        }
      }

      if (!saveError.value && !isDirty) {
        saveState.value = 'saved';
      }
    })().finally(() => {
      isSaving.value = false;
      saveInFlight = null;
    });

    return saveInFlight;
  }

  function updateTypography(patch: Partial<ReaderTypographyValues>): void {
    settings.value = { ...settings.value, ...patch };
    isDirty = true;
    scheduleSave();
  }

  function updateCanvas(values: ReaderCanvasValues): void {
    settings.value = { ...settings.value, ...values };
    isDirty = true;
    scheduleSave();
  }

  function applyPreset(values: ReaderTypographyValues): void {
    updateTypography(values);
  }

  function restoreDefaultTypography(): void {
    applyPreset(getDefaultReaderTypographyPreset().values);
  }

  async function flushSave(): Promise<void> {
    clearSaveTimer();

    if (!isDirty && !saveInFlight) {
      return;
    }

    await savePendingChanges();
  }

  async function retrySave(): Promise<void> {
    clearSaveTimer();
    isDirty = true;
    saveState.value = 'pending';
    await savePendingChanges();
  }

  onUnmounted(clearSaveTimer);

  return {
    settings,
    isSaving: readonly(isSaving),
    saveError: readonly(saveError),
    saveState: readonly(saveState),
    updateTypography,
    updateCanvas,
    applyPreset,
    restoreDefaultTypography,
    flushSave,
    retrySave,
  };
}
