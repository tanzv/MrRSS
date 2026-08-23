/**
 * Composable for settings management
 */
import { ref, type Ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SettingsData } from '@/types/settings';
import { normalizeThemePreference } from '@/utils/theme';
import { parseThemeProfiles, serializeThemeProfiles } from '@/utils/customTheme';
import type { CustomThemeProfile } from '@/types/theme';
import { generateInitialSettings, parseSettingsData } from './useSettings.generated';

const sharedSettings: Ref<SettingsData> = ref(generateInitialSettings());

export function setSettingsFromRawData(data: Record<string, string>) {
  const parsedSettings = parseSettingsData(data);
  const themeProfiles = parseThemeProfiles(parsedSettings.theme_profiles);
  let serializedThemeProfiles = '[]';
  try {
    serializedThemeProfiles = serializeThemeProfiles(themeProfiles);
  } catch (error) {
    console.warn('Invalid custom theme profiles were reset:', error);
  }
  sharedSettings.value = {
    ...parsedSettings,
    theme: normalizeThemePreference(parsedSettings.theme),
    theme_profiles: serializedThemeProfiles,
  };
}

export function useSettings() {
  const { locale } = useI18n();

  const settings = sharedSettings;

  /**
   * Fetch settings from backend
   */
  async function fetchSettings(): Promise<SettingsData> {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();

      // Use generated helper to parse settings (alphabetically sorted)
      setSettingsFromRawData(data);

      return settings.value;
    } catch (e) {
      console.error('Error fetching settings:', e);
      throw e;
    }
  }

  /**
   * Apply fetched settings to the app
   */

  function applySettings(
    data: SettingsData,
    setTheme: (preference: string, profiles?: CustomThemeProfile[]) => void
  ) {
    // Apply the saved language
    if (data.language) {
      locale.value = data.language;
    }

    // Apply the saved theme
    if (data.theme) {
      setTheme(data.theme, parseThemeProfiles(data.theme_profiles));
    }

    // Initialize shortcuts in store
    if (data.shortcuts) {
      try {
        const parsed = JSON.parse(data.shortcuts);
        window.dispatchEvent(
          new CustomEvent('shortcuts-changed', {
            detail: { shortcuts: parsed },
          })
        );
      } catch (e) {
        console.error('Error parsing shortcuts:', e);
      }
    }
  }

  /**
   * Handle settings-updated event
   * Re-fetches settings when backend updates them (e.g., after feed refresh)
   * Skips re-fetching if this is an auto-save event to prevent overwriting user input
   */
  function handleSettingsUpdated(event: Event) {
    const customEvent = event as CustomEvent<{ autoSave?: boolean }>;

    // Skip re-fetching if this is an auto-save event
    // The settings are already up-to-date since we just saved them
    if (customEvent.detail?.autoSave) {
      return;
    }

    fetchSettings().catch((e) => {
      console.error('Error re-fetching settings after update:', e);
    });
  }

  // Listen for settings-updated events
  onMounted(() => {
    window.addEventListener('settings-updated', handleSettingsUpdated);
  });

  onUnmounted(() => {
    window.removeEventListener('settings-updated', handleSettingsUpdated);
  });

  return {
    settings,
    fetchSettings,
    applySettings,
  };
}
