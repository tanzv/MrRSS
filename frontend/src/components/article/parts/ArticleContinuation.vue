<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhArrowRight } from '@phosphor-icons/vue';
import type { Article } from '@/types/models';

const props = defineProps<{
  nextArticle: Article;
}>();

const emit = defineEmits<{
  navigateNext: [];
}>();

const { t } = useI18n();
const feedTitle = computed(() => props.nextArticle.feed_title || props.nextArticle.feed_name);
</script>

<template>
  <section data-testid="article-continuation" class="article-continuation">
    <p class="article-continuation-label">{{ t('article.continuation.upNext') }}</p>
    <h2 class="article-continuation-title">{{ nextArticle.title }}</h2>
    <p v-if="feedTitle" class="article-continuation-feed">{{ feedTitle }}</p>
    <button
      type="button"
      data-testid="article-continuation-next"
      class="article-continuation-action"
      @click="emit('navigateNext')"
    >
      <span>{{ t('article.continuation.readNext') }}</span>
      <PhArrowRight :size="16" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
@reference "../../../style.css";

.article-continuation {
  @apply mt-10 border-t border-border pt-5;
}

.article-continuation-label {
  @apply m-0 text-xs font-medium uppercase text-text-secondary;
  letter-spacing: 0;
}

.article-continuation-title {
  @apply mt-2 mb-1 text-lg font-semibold leading-snug text-text-primary;
  overflow-wrap: anywhere;
}

.article-continuation-feed {
  @apply m-0 text-sm text-text-secondary;
  overflow-wrap: anywhere;
}

.article-continuation-action {
  @apply mt-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-primary transition-colors;
}

.article-continuation-action:hover {
  background-color: var(--bg-tertiary);
}

.article-continuation-action:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
</style>
