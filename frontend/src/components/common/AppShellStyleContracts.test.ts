import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styleSource = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');
const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('app shell style primitives', () => {
  it('gives panel and modal headers one fixed border-box boundary', () => {
    expect(styleSource).toContain('--app-panel-header-height: 56px;');
    expect(styleSource).toContain('--app-modal-header-height: 64px;');
    expect(styleSource).toMatch(
      /\.app-panel-header\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?height:\s*var\(--app-panel-header-height\);[\s\S]*?border-bottom:\s*1px solid var\(--border-color\);/
    );
    expect(styleSource).toMatch(
      /\.app-modal-header\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?height:\s*var\(--app-modal-header-height\);[\s\S]*?border-bottom:\s*1px solid var\(--border-color\);/
    );
  });

  it('provides one responsive size system for text and icon actions', () => {
    for (const className of [
      'ui-page-title',
      'ui-modal-title',
      'ui-section-title',
      'ui-button',
      'ui-button--primary',
      'ui-button--secondary',
      'ui-button--danger',
      'ui-button--ghost',
      'ui-button--compact',
      'ui-icon-button',
      'ui-icon-button--danger',
    ]) {
      expect(styleSource).toContain(`.${className}`);
    }

    expect(styleSource).toMatch(
      /\.ui-icon-button\s*\{[\s\S]*?width:\s*var\(--ui-control-height\);[\s\S]*?height:\s*var\(--ui-control-height\);/
    );
    expect(styleSource).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?--ui-control-height:\s*44px;/
    );
  });

  it('uses panel headers and shared actions in every primary pane', () => {
    for (const file of [
      'src/components/article/ArticleList.vue',
      'src/components/article/ArticleToolbar.vue',
      'src/components/article/imageGallery/components/ImageGalleryHeader.vue',
      'src/components/sidebar/FeedList.vue',
    ]) {
      expect(source(file)).toContain('app-panel-header');
      expect(source(file)).toContain('ui-icon-button');
    }

    expect(source('src/components/article/ArticleDetail.vue')).toContain('app-panel-header');
    expect(source('src/components/article/ArticleDetailModal.vue')).toContain('app-panel-header');
  });

  it('uses shared modal headers and footer actions across the modal system', () => {
    expect(source('src/components/common/BaseModal.vue')).toContain('app-modal-header');
    expect(source('src/components/modals/SettingsModal.vue')).toContain('app-modal-header');

    for (const file of [
      'src/components/modals/discovery/DiscoverFeedsModal.vue',
      'src/components/modals/discovery/DiscoverAllFeedsModal.vue',
      'src/components/modals/filter/ArticleFilterModal.vue',
      'src/components/modals/filter/SavedFilterModal.vue',
      'src/components/modals/rules/RuleEditorModal.vue',
      'src/components/modals/update/UpdateAvailableDialog.vue',
    ]) {
      expect(source(file)).toContain('ui-modal-title');
    }

    expect(source('src/components/common/BaseModal.vue')).toContain('ui-modal-title');
    expect(source('src/components/common/BaseModal.vue')).toContain('ui-icon-button');
    expect(source('src/components/common/ModalFooter.vue')).toContain('ui-button--primary');
    expect(source('src/components/common/ModalFooter.vue')).toContain('ui-button--secondary');
    expect(source('src/components/common/ModalFooter.vue')).toContain('ui-button--danger');
  });

  it('does not keep local legacy button size systems in shared application surfaces', () => {
    for (const file of [
      'src/components/article/ArticleContent.vue',
      'src/components/article/parts/ArticleBody.vue',
      'src/components/modals/SettingsModal.vue',
      'src/components/modals/rules/RuleAction.vue',
      'src/components/modals/rules/RuleConditionItem.vue',
      'src/components/modals/settings/about/AboutTab.vue',
      'src/components/modals/settings/ai/AIFeatureSettings.vue',
      'src/components/modals/settings/ai/AIProfileList.vue',
      'src/components/modals/settings/content/SummarySettings.vue',
      'src/components/modals/settings/content/TranslationSettings.vue',
      'src/components/modals/settings/general/DataManagementSettings.vue',
      'src/components/modals/settings/plugins/FreshRSSSettings.vue',
      'src/components/modals/settings/plugins/RSSHubSettings.vue',
      'src/components/modals/settings/reading/CustomizationSettings.vue',
      'src/components/modals/settings/tags/TagManagementModal.vue',
      'src/components/settings/base/SettingControl/ButtonControl.vue',
      'src/components/settings/base/StatusBoxGroup.vue',
      'src/components/settings/styles.css',
    ]) {
      expect(source(file)).not.toContain('btn-');
    }
  });

  it('keeps secondary panels and setting labels on the same chrome system', () => {
    for (const file of [
      'src/components/article/ArticleChatPanel.vue',
      'src/components/article/ReaderAppearancePanel.vue',
    ]) {
      expect(source(file)).toContain('app-panel-header');
      expect(source(file)).toContain('ui-icon-button');
    }

    for (const file of [
      'src/components/article/AISearchBar.vue',
      'src/components/article/ArticleDetailModal.vue',
      'src/components/common/BaseSelect.vue',
      'src/components/common/BaseMultiSelect.vue',
      'src/components/common/FindInPage.vue',
      'src/components/modals/settings/feeds/BatchActionsDropdown.vue',
      'src/components/modals/settings/rules/RuleItem.vue',
      'src/components/modals/settings/statistics/StatisticsTab.vue',
      'src/components/sidebar/SavedFilterItem.vue',
    ]) {
      expect(source(file)).toContain('ui-button');
    }

    expect(source('src/components/settings/base/SettingGroup.vue')).toContain('ui-section-title');
    expect(source('src/components/settings/base/SettingItem.vue')).toContain('ui-section-title');
  });
});
