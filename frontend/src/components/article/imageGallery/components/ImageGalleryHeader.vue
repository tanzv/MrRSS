<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { PhList, PhTextT, PhTextTSlash, PhEye, PhEyeSlash } from '@phosphor-icons/vue';

interface Props {
  showTextOverlay: boolean;
  showOnlyUnread: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  toggleSidebar: [];
  toggleTextOverlay: [];
  toggleShowOnlyUnread: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="app-panel-header">
    <!-- Sidebar toggle button (mobile only) -->
    <button
      class="ui-icon-button ui-button--ghost md:hidden"
      :title="t('shortcut.toggle.sidebar')"
      @click="emit('toggleSidebar')"
    >
      <PhList :size="24" />
    </button>

    <!-- Title -->
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <h1 class="ui-page-title truncate">
        {{ t('sidebar.activity.imageGallery') }}
      </h1>
    </div>

    <div class="flex items-center gap-2">
      <!-- Show only unread toggle button -->
      <button
        class="ui-icon-button ui-button--ghost"
        :class="showOnlyUnread ? 'ui-button--active' : ''"
        :title="
          showOnlyUnread
            ? t('setting.reading.showAllArticles')
            : t('setting.reading.showOnlyUnread')
        "
        @click="emit('toggleShowOnlyUnread')"
      >
        <PhEyeSlash v-if="showOnlyUnread" :size="20" />
        <PhEye v-else :size="20" />
      </button>

      <!-- Toggle text overlay button -->
      <button
        class="ui-icon-button ui-button--ghost"
        :title="showTextOverlay ? t('setting.reading.hideText') : t('setting.reading.showText')"
        @click="emit('toggleTextOverlay')"
      >
        <PhTextTSlash v-if="showTextOverlay" :size="20" />
        <PhTextT v-else :size="20" />
      </button>
    </div>
  </div>
</template>
