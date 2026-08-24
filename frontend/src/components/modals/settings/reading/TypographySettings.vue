<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhTextT, PhTextIndent, PhTextAa, PhTextColumns, PhParagraph } from '@phosphor-icons/vue';
import { SettingGroup, SettingItem, NumberControl, SettingWithSelect } from '@/components/settings';
import FontFamilySelect from '@/components/settings/FontFamilySelect.vue';
import ReaderCanvasColorControls from '@/components/settings/ReaderCanvasColorControls.vue';
import ReaderTypographyPresetPicker from '@/components/settings/ReaderTypographyPresetPicker.vue';
import ReaderTypographyPreview from '@/components/settings/ReaderTypographyPreview.vue';
import '@/components/settings/styles.css';
import type { SettingsData } from '@/types/settings';
import { resolveReaderCanvas } from '@/utils/readerCanvas';
import { resolveReaderTypography, type ReaderTypographyValues } from '@/utils/readerTypography';

const { t } = useI18n();

interface Props {
  settings: SettingsData;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:settings': [settings: SettingsData];
}>();

// Computed values for display (handle string/number conversion)
const displayContentSize = computed(() => {
  return props.settings.content_font_size || 16;
});
const displayLineHeight = computed(() => {
  return parseFloat(props.settings.content_line_height) || 1.6;
});
const readerTypography = computed(() => resolveReaderTypography(props.settings));
const readerCanvas = computed(() => resolveReaderCanvas(props.settings));

function updateSetting<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
  emit('update:settings', {
    ...props.settings,
    [key]: value,
  });
}

function applyReaderPreset(values: ReaderTypographyValues): void {
  emit('update:settings', {
    ...props.settings,
    ...values,
  });
}
</script>

<template>
  <SettingGroup :icon="PhTextT" :title="t('setting.tab.typography')">
    <ReaderTypographyPresetPicker :settings="settings" @select="applyReaderPreset" />

    <!-- Content Font Family -->
    <SettingItem :icon="PhTextT" :title="t('setting.typography.contentFontFamily')">
      <template #description>
        <div class="text-xs text-text-secondary hidden sm:block">
          {{ t('setting.typography.contentFontFamilyDesc') }}
        </div>
      </template>
      <FontFamilySelect
        :model-value="settings.content_font_family"
        @update:model-value="updateSetting('content_font_family', $event)"
      />
    </SettingItem>

    <!-- Content Font Size -->
    <SettingItem :icon="PhTextAa" :title="t('setting.typography.contentFontSize')">
      <template #description>
        <div class="text-xs text-text-secondary hidden sm:block">
          {{ t('setting.typography.contentFontSizeDesc') }}
        </div>
      </template>
      <NumberControl
        :model-value="displayContentSize"
        :min="10"
        :max="24"
        suffix="px"
        :aria-label="t('setting.typography.contentFontSize')"
        @update:model-value="(v) => updateSetting('content_font_size', isNaN(v) ? 16 : v)"
      />
    </SettingItem>

    <!-- Content Line Height -->
    <SettingItem :icon="PhTextIndent" :title="t('setting.typography.contentLineHeight')">
      <template #description>
        <div class="text-xs text-text-secondary hidden sm:block">
          {{ t('setting.typography.contentLineHeightDesc') }}
        </div>
      </template>
      <NumberControl
        :model-value="displayLineHeight"
        :min="1"
        :max="3"
        :step="0.1"
        :aria-label="t('setting.typography.contentLineHeight')"
        @update:model-value="
          (v) => updateSetting('content_line_height', isNaN(v) ? '1.6' : v.toString())
        "
      />
    </SettingItem>

    <SettingWithSelect
      :icon="PhTextColumns"
      :title="t('setting.typography.contentWidth')"
      :description="t('setting.typography.contentWidthDesc')"
      :model-value="settings.content_width"
      :options="[
        { value: 'narrow', label: t('setting.typography.contentWidthNarrow') },
        { value: 'comfortable', label: t('setting.typography.contentWidthComfortable') },
        { value: 'wide', label: t('setting.typography.contentWidthWide') },
      ]"
      width="md"
      @update:model-value="updateSetting('content_width', $event)"
    />

    <SettingWithSelect
      :icon="PhParagraph"
      :title="t('setting.typography.paragraphSpacing')"
      :description="t('setting.typography.paragraphSpacingDesc')"
      :model-value="settings.content_paragraph_spacing"
      :options="[
        { value: 'compact', label: t('setting.typography.paragraphSpacingCompact') },
        { value: 'comfortable', label: t('setting.typography.paragraphSpacingComfortable') },
        { value: 'relaxed', label: t('setting.typography.paragraphSpacingRelaxed') },
      ]"
      width="md"
      @update:model-value="updateSetting('content_paragraph_spacing', $event)"
    />

    <ReaderCanvasColorControls
      :canvas="settings"
      @update:canvas="(canvas) => emit('update:settings', { ...settings, ...canvas })"
    />

    <ReaderTypographyPreview :typography="readerTypography" :canvas="readerCanvas" />
  </SettingGroup>
</template>

<style scoped>
/* Styles are now handled by BaseSelect and select.css */
</style>
