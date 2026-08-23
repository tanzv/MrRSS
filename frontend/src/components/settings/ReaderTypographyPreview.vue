<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ThemePreset } from '@/utils/theme';
import type { ReaderTypography } from '@/utils/readerTypography';

defineProps<{
  typography: ReaderTypography;
  themePreset: ThemePreset;
}>();

const { t } = useI18n();
</script>

<template>
  <section
    data-testid="reader-typography-preview"
    class="reader-typography-preview"
    role="region"
    :aria-label="t('setting.typography.readerPreview')"
    :data-reader-width="typography.width"
    :data-paragraph-spacing="typography.paragraphSpacing"
    :data-reader-theme="themePreset"
    :style="typography.cssVariables"
  >
    <div class="reader-typography-preview-copy">
      <h3>{{ t('setting.typography.readerPreviewHeading') }}</h3>
      <p>{{ t('setting.typography.readerPreviewFirst') }}</p>
      <p>{{ t('setting.typography.readerPreviewSecond') }}</p>
    </div>
  </section>
</template>

<style scoped>
@reference "../../style.css";

.reader-typography-preview {
  @apply border-y border-border py-3 text-text-primary;
}

.reader-typography-preview-copy {
  @apply min-w-0;
  margin-inline: auto;
  font-family: var(--reader-font-family);
  font-size: var(--reader-font-size);
  line-height: var(--reader-line-height);
}

.reader-typography-preview[data-reader-width='narrow'] .reader-typography-preview-copy {
  max-inline-size: 68%;
}

.reader-typography-preview[data-reader-width='comfortable'] .reader-typography-preview-copy {
  max-inline-size: 84%;
}

.reader-typography-preview[data-reader-width='wide'] .reader-typography-preview-copy {
  max-inline-size: 100%;
}

.reader-typography-preview h3 {
  @apply m-0 font-semibold;
  font-size: 1.15em;
  line-height: 1.35;
}

.reader-typography-preview p {
  @apply m-0 text-text-secondary;
}

.reader-typography-preview p:first-of-type {
  margin-top: var(--reader-paragraph-gap);
}

.reader-typography-preview p + p {
  margin-top: var(--reader-paragraph-gap);
}

@media (max-width: 32rem) {
  .reader-typography-preview[data-reader-width] .reader-typography-preview-copy {
    max-inline-size: 100%;
  }
}
</style>
