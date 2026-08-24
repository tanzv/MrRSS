<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  PhCopy,
  PhDownloadSimple,
  PhFloppyDisk,
  PhPlus,
  PhTrash,
  PhUploadSimple,
  PhPencilSimple,
  PhArrowCounterClockwise,
} from '@phosphor-icons/vue';
import type { SettingsData } from '@/types/settings';
import type {
  BuiltInThemePreset,
  CustomThemeProfile,
  ThemeProfilesDocument,
  ThemeTokenGroup,
  ThemeTokenKey,
} from '@/types/theme';
import {
  CUSTOM_THEME_MAX_PROFILES,
  createCustomThemeProfile,
  getThemePreferenceId,
  isThemeProfilesArray,
  isThemeProfilesDocument,
  parseThemeProfiles,
  serializeThemeProfiles,
  themeContrastPasses,
  validateThemeContrast,
} from '@/utils/customTheme';
import { builtInThemePresets, themeTokenGroups, themeTokenKeys } from '@/types/theme';
import { getSystemPrefersDark } from '@/utils/theme';
import FontFamilySelect from './FontFamilySelect.vue';
import NumberControl from './base/SettingControl/NumberControl.vue';
import ThemeColorField from './ThemeColorField.vue';

interface Props {
  settings: SettingsData;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:settings': [settings: SettingsData];
}>();

const { t } = useI18n();
const localProfiles = ref<CustomThemeProfile[]>(parseThemeProfiles(props.settings.theme_profiles));
const selectedProfileId = ref<string | null>(null);
const editingVariant = ref<'light' | 'dark'>('light');
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const importInput = ref<HTMLInputElement>();
const rejectedTokenVersions = ref<Partial<Record<ThemeTokenKey, number>>>({});

const groupOrder: ThemeTokenGroup[] = ['surface', 'text', 'accent', 'border', 'state', 'reader'];
const groupLabelKeys: Record<ThemeTokenGroup, string> = {
  surface: 'surface',
  text: 'text',
  accent: 'accent',
  border: 'border',
  state: 'state',
  reader: 'reader',
};

const activeProfile = computed(
  () => localProfiles.value.find((profile) => profile.id === selectedProfileId.value) ?? null
);

watch(
  () => props.settings.theme_profiles,
  (raw) => {
    localProfiles.value = parseThemeProfiles(raw);
    const activeId = props.settings.theme.startsWith('custom:')
      ? props.settings.theme.slice('custom:'.length)
      : '';
    if (localProfiles.value.some((profile) => profile.id === activeId)) {
      selectedProfileId.value = activeId;
    } else if (!localProfiles.value.some((profile) => profile.id === selectedProfileId.value)) {
      selectedProfileId.value = localProfiles.value[0]?.id ?? null;
    }
  }
);

watch(
  () => props.settings.theme,
  (theme) => {
    if (theme.startsWith('custom:')) {
      const profileId = theme.slice('custom:'.length);
      if (localProfiles.value.some((profile) => profile.id === profileId)) {
        selectedProfileId.value = profileId;
      }
    }
  },
  { immediate: true }
);

function getTranslation(key: string, fallback: string): string {
  const translated = t(`setting.general.customTheme.${key}`);
  return translated === `setting.general.customTheme.${key}` ? fallback : translated;
}

function tokenLabel(key: ThemeTokenKey): string {
  const fallback = key.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  return getTranslation(`token.${key}`, fallback);
}

function groupLabel(group: ThemeTokenGroup): string {
  return getTranslation(`group.${groupLabelKeys[group]}`, group);
}

function modeLabel(mode: CustomThemeProfile['appearance']): string {
  return getTranslation(`mode.${mode}`, mode);
}

function presetLabel(preset: BuiltInThemePreset): string {
  const key = preset === 'high-contrast' ? 'highContrast' : preset;
  return getTranslation(`preset.${key}`, preset);
}

function activeBasePreset(): BuiltInThemePreset {
  const preference = props.settings.theme;
  if (preference.startsWith('custom:')) {
    const activeId = preference.slice('custom:'.length);
    const active = localProfiles.value.find((profile) => profile.id === activeId);
    if (active) return active.basePreset;
  }
  if (preference === 'auto') {
    return getSystemPrefersDark() ? 'ink' : 'paper';
  }
  return builtInThemePresets.includes(preference as BuiltInThemePreset)
    ? (preference as BuiltInThemePreset)
    : 'paper';
}

function emitProfiles(profiles: CustomThemeProfile[], theme = props.settings.theme): boolean {
  if (profiles.some((profile) => !profilePassesContrast(profile))) {
    window.showToast?.(
      getTranslation('contrastBlocked', 'Custom themes must keep readable text contrast.'),
      'error'
    );
    return false;
  }

  let serialized: string;
  try {
    serialized = serializeThemeProfiles(profiles);
  } catch {
    window.showToast?.(getTranslation('invalidImport', 'Theme data is too large'), 'error');
    return false;
  }
  localProfiles.value = profiles;
  emit('update:settings', {
    ...props.settings,
    theme,
    theme_profiles: serialized,
  });
  return true;
}

function createTheme(): void {
  if (localProfiles.value.length >= CUSTOM_THEME_MAX_PROFILES) return;

  const profile = createCustomThemeProfile(
    getTranslation('newName', 'Custom theme'),
    activeBasePreset(),
    props.settings.ui_font_family,
    props.settings.ui_font_size
  );
  selectedProfileId.value = profile.id;
  editingVariant.value = 'light';
  emitProfiles([...localProfiles.value, profile], getThemePreferenceId(profile));
}

function activateTheme(profile: CustomThemeProfile): void {
  selectedProfileId.value = profile.id;
  emitProfiles(localProfiles.value, getThemePreferenceId(profile));
}

function updateProfile(update: (profile: CustomThemeProfile) => CustomThemeProfile): boolean {
  if (!activeProfile.value) return false;
  const updatedProfiles = localProfiles.value.map((profile) =>
    profile.id === activeProfile.value?.id ? update(profile) : profile
  );
  return emitProfiles(
    updatedProfiles,
    getThemePreferenceId(updatedProfiles.find((profile) => profile.id === activeProfile.value?.id)!)
  );
}

function updateToken(key: ThemeTokenKey, value: string | undefined): void {
  const updated = updateProfile((profile) => {
    const overrides = { ...profile[editingVariant.value] };
    if (value) {
      overrides[key] = value;
    } else {
      delete overrides[key];
    }
    return {
      ...profile,
      [editingVariant.value]: overrides,
      updatedAt: new Date().toISOString(),
    };
  });
  if (!updated) {
    rejectedTokenVersions.value = {
      ...rejectedTokenVersions.value,
      [key]: (rejectedTokenVersions.value[key] ?? 0) + 1,
    };
  }
}

function updateFont(value: string | number): void {
  updateProfile((profile) => ({
    ...profile,
    uiFontFamily: String(value),
    updatedAt: new Date().toISOString(),
  }));
}

function updateFontSize(value: number): void {
  updateProfile((profile) => ({
    ...profile,
    uiFontSize: value,
    updatedAt: new Date().toISOString(),
  }));
}

function updateAppearance(value: CustomThemeProfile['appearance']): void {
  updateProfile((profile) => ({
    ...profile,
    appearance: value,
    updatedAt: new Date().toISOString(),
  }));
}

function updateBasePreset(value: string): void {
  if (!builtInThemePresets.includes(value as BuiltInThemePreset)) return;
  updateProfile((profile) => ({
    ...profile,
    basePreset: value as BuiltInThemePreset,
    light: {},
    dark: {},
    updatedAt: new Date().toISOString(),
  }));
}

function duplicateTheme(): void {
  if (!activeProfile.value || localProfiles.value.length >= CUSTOM_THEME_MAX_PROFILES) return;
  const source = activeProfile.value;
  const copy = createCustomThemeProfile(
    `${source.name} Copy`,
    source.basePreset,
    source.uiFontFamily,
    source.uiFontSize
  );
  const duplicate = {
    ...copy,
    appearance: source.appearance,
    light: { ...source.light },
    dark: { ...source.dark },
  };
  selectedProfileId.value = duplicate.id;
  emitProfiles([...localProfiles.value, duplicate], getThemePreferenceId(duplicate));
}

function beginRename(): void {
  if (!activeProfile.value) return;
  renamingId.value = activeProfile.value.id;
  renameValue.value = activeProfile.value.name;
}

function commitRename(): void {
  if (!renamingId.value || !renameValue.value.trim()) return;
  const id = renamingId.value;
  const name = renameValue.value.trim().slice(0, 48);
  emitProfiles(
    localProfiles.value.map((profile) =>
      profile.id === id ? { ...profile, name, updatedAt: new Date().toISOString() } : profile
    ),
    props.settings.theme
  );
  renamingId.value = null;
}

function deleteTheme(): void {
  if (!activeProfile.value) return;
  const deletedId = activeProfile.value.id;
  const remaining = localProfiles.value.filter((profile) => profile.id !== deletedId);
  selectedProfileId.value = remaining[0]?.id ?? null;
  const nextTheme =
    props.settings.theme === getThemePreferenceId(activeProfile.value)
      ? 'paper'
      : props.settings.theme;
  emitProfiles(remaining, nextTheme);
}

function resetProfile(): void {
  updateProfile((profile) => ({
    ...profile,
    light: {},
    dark: {},
    uiFontFamily: 'system',
    uiFontSize: 16,
    updatedAt: new Date().toISOString(),
  }));
}

interface ThemeTokenResolution {
  tokens: Record<ThemeTokenKey, string>;
  resolved: boolean;
}

function readBaseThemeTokens(profile: CustomThemeProfile): ThemeTokenResolution {
  const tokens = {} as Record<ThemeTokenKey, string>;
  if (typeof document === 'undefined') {
    return { tokens, resolved: false };
  }

  const root = document.documentElement;
  const previousPreset = root.dataset.themePreset;
  const previousProfile = root.dataset.themeProfile;
  const previousValues = new Map<ThemeTokenKey, string>();
  themeTokenKeys.forEach((key) => {
    previousValues.set(key, root.style.getPropertyValue(`--${key}`));
    root.style.removeProperty(`--${key}`);
  });

  root.dataset.themePreset = profile.basePreset;
  const computedStyles = getComputedStyle(root);
  let resolved = true;
  themeTokenKeys.forEach((key) => {
    const value = computedStyles.getPropertyValue(`--${key}`).trim();
    if (!value) resolved = false;
    tokens[key] = value || '#ffffff';
  });

  if (previousPreset) root.dataset.themePreset = previousPreset;
  else root.removeAttribute('data-theme-preset');
  if (previousProfile) root.dataset.themeProfile = previousProfile;
  else root.removeAttribute('data-theme-profile');
  previousValues.forEach((value, key) => {
    if (value) root.style.setProperty(`--${key}`, value);
    else root.style.removeProperty(`--${key}`);
  });

  return { tokens, resolved };
}

const baseThemeResolution = computed(() =>
  activeProfile.value
    ? readBaseThemeTokens(activeProfile.value)
    : { tokens: {} as Record<ThemeTokenKey, string>, resolved: false }
);

function getInheritedValue(key: ThemeTokenKey, profile: CustomThemeProfile | null): string {
  if (!profile || profile.id !== activeProfile.value?.id) return '';
  return baseThemeResolution.value.tokens[key] || '';
}

function profilePassesContrast(profile: CustomThemeProfile): boolean {
  const base = readBaseThemeTokens(profile);
  if (!base.resolved) {
    return true;
  }

  return (['light', 'dark'] as const).every((variant) =>
    themeContrastPasses(validateThemeContrast({ ...base.tokens, ...profile[variant] }))
  );
}

const contrastReport = computed(() => {
  const profile = activeProfile.value;
  if (!profile) {
    return validateThemeContrast({} as Record<ThemeTokenKey, string>);
  }

  return validateThemeContrast({
    ...baseThemeResolution.value.tokens,
    ...profile[editingVariant.value],
  });
});

const contrastItems = computed(() => {
  const report = contrastReport.value;
  const stateKeys = ['favorite', 'readLater', 'info', 'success', 'warning', 'danger'];
  return [
    {
      key: 'primary',
      label: getTranslation('contrastPrimary', 'Primary text'),
      check: report.primary,
    },
    {
      key: 'secondary',
      label: getTranslation('contrastSecondary', 'Secondary text'),
      check: report.secondary,
    },
    { key: 'accent', label: getTranslation('contrastAccent', 'Accent text'), check: report.accent },
    {
      key: 'background-warning',
      label: getTranslation('contrastBackgroundWarning', 'Pinned drawer warning indicator'),
      check: report.backgroundWarning,
    },
    {
      key: 'accent-foreground',
      label: getTranslation('contrastAccentForeground', 'Accent action'),
      check: report.accentForeground,
    },
    {
      key: 'accent-hover',
      label: getTranslation('contrastAccentHover', 'Accent action hover'),
      check: report.accentHover,
    },
    {
      key: 'selection',
      label: getTranslation('contrastSelection', 'Selection'),
      check: report.selection,
    },
    {
      key: 'rail-secondary',
      label: getTranslation('contrastRailSecondary', 'Activity rail text'),
      check: report.railSecondary,
    },
    {
      key: 'rail-accent',
      label: getTranslation('contrastRailAccent', 'Activity rail accent'),
      check: report.railAccent,
    },
    {
      key: 'panel-primary',
      label: getTranslation('contrastPanelPrimary', 'Panel primary text'),
      check: report.panelPrimary,
    },
    {
      key: 'panel-secondary',
      label: getTranslation('contrastPanelSecondary', 'Panel secondary text'),
      check: report.panelSecondary,
    },
    {
      key: 'panel-accent',
      label: getTranslation('contrastPanelAccent', 'Panel accent text'),
      check: report.panelAccent,
    },
    {
      key: 'panel-warning',
      label: getTranslation('contrastPanelWarning', 'Panel warning indicator'),
      check: report.panelWarning,
    },
    {
      key: 'hover-primary',
      label: getTranslation('contrastHoverPrimary', 'Hover primary text'),
      check: report.hoverPrimary,
    },
    {
      key: 'hover-secondary',
      label: getTranslation('contrastHoverSecondary', 'Hover secondary text'),
      check: report.hoverSecondary,
    },
    {
      key: 'hover-accent',
      label: getTranslation('contrastHoverAccent', 'Hover accent text'),
      check: report.hoverAccent,
    },
    {
      key: 'hover-warning',
      label: getTranslation('contrastHoverWarning', 'Hover warning indicator'),
      check: report.hoverWarning,
    },
    {
      key: 'selected-accent',
      label: getTranslation('contrastSelectedAccent', 'Selected item text'),
      check: report.selectedAccent,
    },
    {
      key: 'selected-secondary',
      label: getTranslation('contrastSelectedSecondary', 'Selected item secondary text'),
      check: report.selectedSecondary,
    },
    {
      key: 'selected-warning',
      label: getTranslation('contrastSelectedWarning', 'Selected item warning indicator'),
      check: report.selectedWarning,
    },
    {
      key: 'unread-badge',
      label: getTranslation('contrastUnreadBadge', 'Unread badge'),
      check: report.unreadBadge,
    },
    ...report.states.map((check, index) => ({
      key: `state-${stateKeys[index] ?? index}`,
      label: getTranslation(
        `state.${stateKeys[index] ?? index}`,
        `${stateKeys[index] ?? 'State'} text`
      ),
      check,
    })),
  ];
});

const contrastPasses = computed(() => themeContrastPasses(contrastReport.value));

function contrastRatioLabel(ratio: number): string {
  return Number.isFinite(ratio) && ratio > 0 ? `${ratio.toFixed(1)}:1` : '—';
}

function contrastPairLabel(item: (typeof contrastItems.value)[number]): string {
  return `${item.label}: ${item.check.foreground} / ${item.check.background}`;
}

function exportThemes(): void {
  const documentValue: ThemeProfilesDocument = { version: 1, profiles: localProfiles.value };
  const blob = new Blob([JSON.stringify(documentValue, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mrrss-themes.json';
  link.click();
  URL.revokeObjectURL(url);
}

function openImport(): void {
  importInput.value?.click();
}

async function importThemes(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const raw: unknown = JSON.parse(text);
    const sourceProfiles = Array.isArray(raw)
      ? isThemeProfilesArray(raw)
        ? raw
        : null
      : isThemeProfilesDocument(raw)
        ? raw.profiles
        : null;
    if (!sourceProfiles || sourceProfiles.length > 20) {
      throw new Error('Unsupported theme document');
    }
    const parsed = parseThemeProfiles(sourceProfiles);
    const nextProfile = parsed[0];
    if (emitProfiles(parsed, nextProfile ? getThemePreferenceId(nextProfile) : 'paper')) {
      selectedProfileId.value = nextProfile?.id ?? null;
    }
  } catch {
    window.showToast?.(getTranslation('invalidImport', 'Invalid theme file'), 'error');
  }
}
</script>

<template>
  <section class="custom-theme-manager" data-theme-manager>
    <div class="custom-theme-header">
      <div>
        <h4 class="custom-theme-title">{{ getTranslation('title', 'Custom themes') }}</h4>
        <p class="custom-theme-description">
          {{
            getTranslation(
              'description',
              'Tune the application shell without changing reader typography.'
            )
          }}
        </p>
      </div>
      <div class="custom-theme-actions">
        <button
          type="button"
          class="theme-icon-button"
          data-action="new-theme"
          :aria-label="getTranslation('new', 'New custom theme')"
          :title="getTranslation('new', 'New custom theme')"
          :disabled="localProfiles.length >= CUSTOM_THEME_MAX_PROFILES"
          @click="createTheme"
        >
          <PhPlus :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="theme-icon-button"
          :aria-label="getTranslation('import', 'Import themes')"
          :title="getTranslation('import', 'Import themes')"
          @click="openImport"
        >
          <PhUploadSimple :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="theme-icon-button"
          :disabled="localProfiles.length === 0"
          :aria-label="getTranslation('export', 'Export themes')"
          :title="getTranslation('export', 'Export themes')"
          @click="exportThemes"
        >
          <PhDownloadSimple :size="17" aria-hidden="true" />
        </button>
        <input
          ref="importInput"
          class="hidden"
          type="file"
          accept="application/json,.json"
          @change="importThemes"
        />
      </div>
    </div>

    <div v-if="localProfiles.length === 0" class="custom-theme-empty">
      <p>
        {{ getTranslation('empty', 'Create a theme to customize application colors and font.') }}
      </p>
      <button
        type="button"
        class="theme-primary-button"
        data-action="new-theme"
        @click="createTheme"
      >
        <PhPlus :size="16" aria-hidden="true" />
        {{ getTranslation('new', 'New custom theme') }}
      </button>
    </div>

    <div v-else class="custom-theme-workspace">
      <div
        class="custom-theme-profile-list"
        role="list"
        :aria-label="getTranslation('list', 'Custom themes')"
      >
        <div
          v-for="profile in localProfiles"
          :key="profile.id"
          class="custom-theme-profile-row"
          role="listitem"
        >
          <button
            type="button"
            class="custom-theme-profile-button"
            :class="{ 'is-selected': profile.id === activeProfile?.id }"
            :data-profile-id="profile.id"
            :aria-current="
              profile.id === props.settings.theme.slice('custom:'.length) ? 'true' : undefined
            "
            @click="activateTheme(profile)"
          >
            <span
              class="custom-theme-profile-swatch"
              :style="{ backgroundColor: profile.light['accent-color'] || 'var(--accent-color)' }"
            ></span>
            <span class="custom-theme-profile-name">{{ profile.name }}</span>
          </button>
        </div>
      </div>

      <div v-if="activeProfile" class="custom-theme-editor">
        <div class="custom-theme-editor-heading">
          <div v-if="renamingId !== activeProfile.id" class="custom-theme-name-line">
            <h5>{{ activeProfile.name }}</h5>
            <button
              type="button"
              class="theme-icon-button"
              data-action="rename-theme"
              :aria-label="getTranslation('rename', 'Rename theme')"
              @click="beginRename"
            >
              <PhPencilSimple :size="15" aria-hidden="true" />
            </button>
          </div>
          <form v-else class="custom-theme-rename-form" @submit.prevent="commitRename">
            <input
              v-model="renameValue"
              type="text"
              maxlength="48"
              :aria-label="getTranslation('name', 'Theme name')"
            />
            <button
              type="submit"
              class="theme-icon-button"
              :aria-label="getTranslation('saveName', 'Save name')"
            >
              <PhFloppyDisk :size="15" aria-hidden="true" />
            </button>
          </form>
          <div class="custom-theme-editor-actions">
            <button
              type="button"
              class="theme-icon-button"
              data-action="duplicate-theme"
              :aria-label="getTranslation('duplicate', 'Duplicate theme')"
              :title="getTranslation('duplicate', 'Duplicate theme')"
              :disabled="localProfiles.length >= CUSTOM_THEME_MAX_PROFILES"
              @click="duplicateTheme"
            >
              <PhCopy :size="16" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="theme-icon-button"
              data-action="delete-theme"
              :aria-label="getTranslation('delete', 'Delete theme')"
              :title="getTranslation('delete', 'Delete theme')"
              @click="deleteTheme"
            >
              <PhTrash :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="custom-theme-basics">
          <label class="custom-theme-select-label">
            <span>{{ getTranslation('basePreset', 'Base preset') }}</span>
            <select
              :value="activeProfile.basePreset"
              @change="updateBasePreset(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="preset in builtInThemePresets" :key="preset" :value="preset">
                {{ presetLabel(preset) }}
              </option>
            </select>
          </label>
          <div
            class="custom-theme-appearance"
            data-appearance-group
            role="radiogroup"
            :aria-label="getTranslation('appearance', 'Appearance mode')"
          >
            <button
              v-for="mode in ['auto', 'light', 'dark'] as const"
              :key="mode"
              type="button"
              role="radio"
              :aria-checked="activeProfile.appearance === mode"
              :data-appearance="mode"
              @click="updateAppearance(mode)"
            >
              {{ modeLabel(mode) }}
            </button>
          </div>
        </div>

        <div class="custom-theme-fonts">
          <label class="custom-theme-control-label">{{
            getTranslation('font', 'Application font')
          }}</label>
          <FontFamilySelect
            :model-value="activeProfile.uiFontFamily"
            @update:model-value="updateFont"
          />
          <NumberControl
            :model-value="activeProfile.uiFontSize"
            :min="12"
            :max="20"
            suffix="px"
            :aria-label="getTranslation('fontSize', 'Application font size')"
            @update:model-value="updateFontSize"
          />
        </div>

        <div
          class="custom-theme-variant-tabs"
          data-variant-tabs
          role="tablist"
          :aria-label="getTranslation('variant', 'Color variant')"
        >
          <button
            v-for="variant in ['light', 'dark'] as const"
            :key="variant"
            type="button"
            role="tab"
            :aria-selected="editingVariant === variant"
            :data-variant="variant"
            @click="editingVariant = variant"
          >
            {{ modeLabel(variant) }}
          </button>
        </div>

        <div
          v-for="group in groupOrder"
          :key="group"
          class="custom-theme-token-group"
          :data-token-group="group"
        >
          <h6>{{ groupLabel(group) }}</h6>
          <div class="custom-theme-token-list">
            <div v-for="key in themeTokenGroups[group]" :key="key" :data-token="key">
              <ThemeColorField
                :model-value="activeProfile[editingVariant][key]"
                :label="tokenLabel(key)"
                :inherited-value="getInheritedValue(key, activeProfile)"
                :reset-label="getTranslation('resetToken', 'Reset token')"
                :reset-version="rejectedTokenVersions[key] ?? 0"
                @update:model-value="updateToken(key, $event)"
              />
            </div>
          </div>
        </div>

        <div
          class="custom-theme-contrast"
          data-contrast-status
          :class="{ 'is-invalid': !contrastPasses }"
        >
          <div class="custom-theme-contrast-summary">
            <span class="custom-theme-contrast-icon" aria-hidden="true">{{
              contrastPasses ? '✓' : '!'
            }}</span>
            <span>{{
              contrastPasses
                ? getTranslation('contrastPass', 'All theme contrast checks pass')
                : getTranslation('contrastFail', 'Some theme contrast checks need improvement')
            }}</span>
          </div>
          <div
            class="custom-theme-contrast-grid"
            role="list"
            :aria-label="getTranslation('contrastDetails', 'Contrast checks')"
          >
            <div
              v-for="item in contrastItems"
              :key="item.key"
              class="custom-theme-contrast-item"
              :class="{ 'is-invalid': !item.check.passes }"
              role="listitem"
              :aria-label="contrastPairLabel(item)"
            >
              <span>{{ item.label }}</span>
              <strong>{{ contrastRatioLabel(item.check.ratio) }}</strong>
            </div>
          </div>
          <button
            type="button"
            class="theme-icon-button"
            data-action="reset-profile"
            :aria-label="getTranslation('resetProfile', 'Reset theme')"
            :title="getTranslation('resetProfile', 'Reset theme')"
            @click="resetProfile"
          >
            <PhArrowCounterClockwise :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference "../../style.css";

.custom-theme-manager {
  @apply flex flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-3;
}

.custom-theme-header,
.custom-theme-editor-heading,
.custom-theme-name-line,
.custom-theme-basics,
.custom-theme-fonts,
.custom-theme-actions,
.custom-theme-editor-actions,
.custom-theme-controls {
  @apply flex items-center gap-2;
}

.custom-theme-header,
.custom-theme-editor-heading,
.custom-theme-basics {
  @apply justify-between;
}

.custom-theme-title {
  @apply text-sm font-semibold text-text-primary;
}

.custom-theme-description,
.custom-theme-empty p {
  @apply text-xs text-text-secondary;
}

.theme-icon-button {
  @apply flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent;
}

.theme-primary-button {
  @apply inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent;
}

.custom-theme-empty {
  @apply flex flex-wrap items-center justify-between gap-3 rounded border border-dashed border-border bg-bg-primary p-3;
}

.custom-theme-workspace {
  @apply grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)];
}

.custom-theme-profile-list {
  @apply flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible;
}

.custom-theme-profile-row {
  @apply min-w-36;
}

.custom-theme-profile-button {
  @apply flex w-full items-center gap-2 rounded border border-transparent px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-tertiary;
}

.custom-theme-profile-button.is-selected {
  @apply border-border bg-bg-primary text-text-primary;
}

.custom-theme-profile-swatch {
  @apply h-3 w-3 shrink-0 rounded-full border border-border;
}

.custom-theme-profile-name {
  @apply min-w-0 truncate;
}

.custom-theme-editor {
  @apply flex min-w-0 flex-col gap-3;
}

.custom-theme-editor-heading h5 {
  @apply text-sm font-semibold text-text-primary;
}

.custom-theme-rename-form {
  @apply flex items-center gap-1;
}

.custom-theme-rename-form input,
.custom-theme-select-label select {
  @apply rounded border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent;
}

.custom-theme-select-label {
  @apply flex min-w-0 items-center gap-2 text-xs text-text-secondary;
}

.custom-theme-appearance,
.custom-theme-variant-tabs {
  @apply flex items-center gap-1 rounded border border-border bg-bg-primary p-0.5;
}

.custom-theme-appearance button,
.custom-theme-variant-tabs button {
  @apply rounded px-2 py-1 text-xs capitalize text-text-secondary transition-colors hover:bg-bg-tertiary;
}

.custom-theme-appearance button[aria-checked='true'],
.custom-theme-variant-tabs button[aria-selected='true'] {
  @apply text-text-primary;
  background-color: var(--surface-selected);
}

.custom-theme-fonts {
  @apply flex-wrap rounded border border-border bg-bg-primary p-2;
}

.custom-theme-control-label {
  @apply mr-auto text-xs font-medium text-text-secondary;
}

.custom-theme-variant-tabs {
  @apply w-fit;
}

.custom-theme-token-group {
  @apply flex flex-col gap-1.5;
}

.custom-theme-token-group h6 {
  @apply text-xs font-semibold capitalize text-text-secondary;
}

.custom-theme-token-list {
  @apply grid gap-1.5 sm:grid-cols-2;
}

.custom-theme-contrast {
  @apply grid gap-2 rounded px-2 py-1.5 text-xs;
  border: 1px solid var(--state-success-border);
  background-color: var(--state-success-background);
  color: var(--state-success-color);
}

.custom-theme-contrast.is-invalid {
  border-color: var(--state-warning-border);
  background: var(--state-warning-background);
  color: var(--state-warning-color);
}

.custom-theme-contrast-summary {
  @apply flex items-center gap-2;
}

.custom-theme-contrast-icon {
  @apply font-semibold;
}

.custom-theme-contrast-grid {
  @apply grid grid-cols-2 gap-1 sm:grid-cols-3;
}

.custom-theme-contrast-item {
  @apply flex min-w-0 items-center justify-between gap-2 rounded border border-transparent px-1.5 py-1 text-[0.68rem];
  background-color: color-mix(in srgb, var(--state-success-color) 8%, transparent);
}

.custom-theme-contrast-item strong {
  @apply shrink-0 font-semibold;
}

.custom-theme-contrast-item.is-invalid {
  border-color: var(--state-warning-border);
  background-color: color-mix(in srgb, var(--state-warning-color) 12%, transparent);
}

@media (max-width: 36rem) {
  .custom-theme-basics {
    @apply items-start flex-col;
  }

  .custom-theme-fonts {
    @apply items-start;
  }
}
</style>
