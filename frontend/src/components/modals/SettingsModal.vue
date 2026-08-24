<script setup lang="ts">
import { useAppStore } from '@/stores/app';
import { useI18n } from 'vue-i18n';
import { ref, onMounted, type Ref } from 'vue';
import GeneralTab from './settings/general/GeneralTab.vue';
import ReadingDisplayTab from './settings/reading/ReadingDisplayTab.vue';
import FeedsTab from './settings/feeds/FeedsTab.vue';
import ContentTab from './settings/content/ContentTab.vue';
import AITab from './settings/ai/AITab.vue';
import NetworkTab from './settings/network/NetworkTab.vue';
import PluginsTab from './settings/plugins/PluginsTab.vue';
import ShortcutsTab from './settings/shortcuts/ShortcutsTab.vue';
import RulesTab from './settings/rules/RulesTab.vue';
import StatisticsTab from './settings/statistics/StatisticsTab.vue';
import AboutTab from './settings/about/AboutTab.vue';
import DiscoverAllFeedsModal from './discovery/DiscoverAllFeedsModal.vue';
import {
  PhGear,
  PhSlidersHorizontal,
  PhBookOpen,
  PhRss,
  PhTextT,
  PhBrain,
  PhFunnel,
  PhGlobe,
  PhPuzzlePiece,
  PhKeyboard,
  PhChartBar,
  PhInfo,
  PhX,
} from '@phosphor-icons/vue';
import type { TabName } from '@/types/settings';
import { useSettings } from '@/composables/core/useSettings';
import { useAppUpdates } from '@/composables/core/useAppUpdates';
import { useFeedManagement } from '@/composables/feed/useFeedManagement';
import { useModalClose, LARGE_MODAL_Z_INDEX } from '@/composables/ui/useModalClose';

const store = useAppStore();
const { t } = useI18n();

// Modal close handling - use lower z-index for large modal so nested modals appear on top
const { zIndex: modalZIndex } = useModalClose(() => emit('close'), LARGE_MODAL_Z_INDEX);

// Use composables
const { settings, fetchSettings, applySettings } = useSettings();
const {
  updateInfo,
  checkingUpdates,
  downloadingUpdate,
  installingUpdate,
  downloadProgress,
  checkForUpdates: handleCheckUpdates,
  downloadAndInstallUpdate: handleDownloadInstallUpdate,
} = useAppUpdates();
const {
  handleImportOPML,
  handleExportOPML,
  handleCleanupDatabase,
  handleAddFeed,
  handleEditFeed,
  handleDeleteFeed,
  handleBatchDelete,
  handleBatchMove,
  handleBatchAddTags,
  handleBatchSetImageMode,
  handleBatchUnsetImageMode,
} = useFeedManagement();

const emit = defineEmits<{
  close: [];
}>();

const activeTab: Ref<TabName> = ref('general');
const showDiscoverAllModal = ref(false);

onMounted(async () => {
  try {
    const data = await fetchSettings();
    applySettings(data, (theme: string, profiles) => store.setTheme(theme, profiles));
  } catch (e) {
    console.error('Error loading settings:', e);
  }
});

function handleDiscoverAll() {
  showDiscoverAllModal.value = true;
}
</script>

<template>
  <div
    class="overlay-backdrop fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    :style="{ zIndex: modalZIndex }"
    data-modal-open="true"
    data-settings-modal="true"
  >
    <div
      class="settings-modal-panel bg-bg-primary w-full max-w-5xl h-full sm:h-[800px] sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl shadow-2xl border border-border overflow-hidden animate-fade-in mx-2 sm:mx-4 my-2 sm:my-4"
    >
      <div class="p-3 sm:p-5 border-b border-border flex justify-between items-center shrink-0">
        <h3 class="text-text-secondary sm:text-lg font-semibold m-0 flex items-center gap-2">
          <PhGear :size="20" :weight="'fill'" class="sm:w-6 sm:h-6" />
          {{ t('setting.tab.settingsTitle') }}
        </h3>
        <button
          type="button"
          class="text-xl sm:text-2xl p-1 text-text-secondary hover:text-text-primary"
          :title="t('common.close')"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          <PhX :size="20" class="sm:w-6 sm:h-6" />
        </button>
      </div>

      <div class="flex flex-1 min-h-0 overflow-hidden">
        <!-- Sidebar Navigation -->
        <div class="w-12 sm:w-56 border-r border-border bg-bg-secondary shrink-0 overflow-y-scroll">
          <nav class="p-1 sm:p-2 space-y-1" :aria-label="t('setting.tab.settingsTitle')">
            <button
              :class="['sidebar-tab-btn', activeTab === 'general' ? 'active' : '']"
              :title="t('setting.tab.general')"
              :aria-label="t('setting.tab.general')"
              :aria-current="activeTab === 'general' ? 'page' : undefined"
              @click="activeTab = 'general'"
            >
              <PhSlidersHorizontal :size="22" />
              <span>{{ t('setting.tab.general') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'reading' ? 'active' : '']"
              :title="t('setting.tab.readingAndDisplay')"
              :aria-label="t('setting.tab.readingAndDisplay')"
              :aria-current="activeTab === 'reading' ? 'page' : undefined"
              @click="activeTab = 'reading'"
            >
              <PhBookOpen :size="22" />
              <span>{{ t('setting.tab.readingAndDisplay') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'feeds' ? 'active' : '']"
              :title="t('sidebar.feedList.feeds')"
              :aria-label="t('sidebar.feedList.feeds')"
              :aria-current="activeTab === 'feeds' ? 'page' : undefined"
              @click="activeTab = 'feeds'"
            >
              <PhRss :size="22" />
              <span>{{ t('sidebar.feedList.feeds') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'content' ? 'active' : '']"
              :title="t('setting.tab.content')"
              :aria-label="t('setting.tab.content')"
              :aria-current="activeTab === 'content' ? 'page' : undefined"
              @click="activeTab = 'content'"
            >
              <PhTextT :size="22" />
              <span>{{ t('setting.tab.content') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'ai' ? 'active' : '']"
              :title="t('setting.tab.ai')"
              :aria-label="t('setting.tab.ai')"
              :aria-current="activeTab === 'ai' ? 'page' : undefined"
              @click="activeTab = 'ai'"
            >
              <PhBrain :size="22" />
              <span>{{ t('setting.tab.ai') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'rules' ? 'active' : '']"
              :title="t('modal.rule.rules')"
              :aria-label="t('modal.rule.rules')"
              :aria-current="activeTab === 'rules' ? 'page' : undefined"
              @click="activeTab = 'rules'"
            >
              <PhFunnel :size="22" />
              <span>{{ t('modal.rule.rules') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'network' ? 'active' : '']"
              :title="t('setting.tab.network')"
              :aria-label="t('setting.tab.network')"
              :aria-current="activeTab === 'network' ? 'page' : undefined"
              @click="activeTab = 'network'"
            >
              <PhGlobe :size="22" />
              <span>{{ t('setting.tab.network') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'plugins' ? 'active' : '']"
              :title="t('setting.tab.plugins')"
              :aria-label="t('setting.tab.plugins')"
              :aria-current="activeTab === 'plugins' ? 'page' : undefined"
              @click="activeTab = 'plugins'"
            >
              <PhPuzzlePiece :size="22" />
              <span>{{ t('setting.tab.plugins') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'shortcuts' ? 'active' : '']"
              :title="t('setting.shortcut.shortcuts')"
              :aria-label="t('setting.shortcut.shortcuts')"
              :aria-current="activeTab === 'shortcuts' ? 'page' : undefined"
              @click="activeTab = 'shortcuts'"
            >
              <PhKeyboard :size="22" />
              <span>{{ t('setting.shortcut.shortcuts') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'statistics' ? 'active' : '']"
              :title="t('setting.statistic.statistics')"
              :aria-label="t('setting.statistic.statistics')"
              :aria-current="activeTab === 'statistics' ? 'page' : undefined"
              @click="activeTab = 'statistics'"
            >
              <PhChartBar :size="22" />
              <span>{{ t('setting.statistic.statistics') }}</span>
            </button>
            <button
              :class="['sidebar-tab-btn', activeTab === 'about' ? 'active' : '']"
              :title="t('setting.tab.about')"
              :aria-label="t('setting.tab.about')"
              :aria-current="activeTab === 'about' ? 'page' : undefined"
              @click="activeTab = 'about'"
            >
              <PhInfo :size="22" />
              <span>{{ t('setting.tab.about') }}</span>
            </button>
          </nav>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-scroll p-3 sm:p-6 min-h-0 scroll-smooth">
          <GeneralTab
            v-if="activeTab === 'general'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <ReadingDisplayTab
            v-if="activeTab === 'reading'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <FeedsTab
            v-if="activeTab === 'feeds'"
            :settings="settings"
            @import-opml="handleImportOPML"
            @export-opml="handleExportOPML"
            @cleanup-database="handleCleanupDatabase"
            @add-feed="handleAddFeed"
            @edit-feed="handleEditFeed"
            @delete-feed="handleDeleteFeed"
            @batch-delete="handleBatchDelete"
            @batch-move="handleBatchMove"
            @batch-add-tags="handleBatchAddTags"
            @batch-set-image-mode="handleBatchSetImageMode"
            @batch-unset-image-mode="handleBatchUnsetImageMode"
            @discover-all="handleDiscoverAll"
            @select-feed="emit('close')"
            @update:settings="settings = $event"
          />

          <ContentTab
            v-if="activeTab === 'content'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <AITab
            v-if="activeTab === 'ai'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <NetworkTab
            v-if="activeTab === 'network'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <PluginsTab
            v-if="activeTab === 'plugins'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <RulesTab
            v-if="activeTab === 'rules'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <ShortcutsTab
            v-if="activeTab === 'shortcuts'"
            :settings="settings"
            @update:settings="settings = $event"
          />

          <StatisticsTab v-if="activeTab === 'statistics'" />

          <AboutTab
            v-if="activeTab === 'about'"
            :update-info="updateInfo"
            :checking-updates="checkingUpdates"
            :downloading-update="downloadingUpdate"
            :installing-update="installingUpdate"
            :download-progress="downloadProgress"
            @check-updates="handleCheckUpdates"
            @download-install-update="handleDownloadInstallUpdate"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Discover All Feeds Modal (Teleported to body) -->
  <Teleport to="body">
    <DiscoverAllFeedsModal :show="showDiscoverAllModal" @close="showDiscoverAllModal = false" />
  </Teleport>
</template>

<style scoped>
@reference "../../style.css";
.sidebar-tab-btn {
  @apply w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-transparent text-text-secondary font-medium cursor-pointer transition-all relative;
}

@media (max-width: 39.9375rem) {
  .settings-modal-panel {
    width: calc(100% - 1rem);
    height: calc(100% - 1rem);
    border-radius: 0.75rem;
  }
}

@media (max-width: 39.9375rem) {
  .sidebar-tab-btn {
    @apply justify-center px-1.5;
  }

  .sidebar-tab-btn span {
    @apply sr-only;
  }

  .sidebar-tab-btn.active::before {
    top: 4px;
    bottom: 4px;
  }
}

.sidebar-tab-btn:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.sidebar-tab-btn.active {
  @apply text-accent;
  background-color: var(--surface-selected);
}

.sidebar-tab-btn.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background: var(--accent-color);
  border-radius: 0 2px 2px 0;
}

.btn-primary {
  @apply bg-accent text-text-on-accent border-none px-5 py-2.5 rounded-lg cursor-pointer font-semibold hover:bg-accent-hover transition-colors;
}

.animate-fade-in {
  animation: modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalFadeIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
