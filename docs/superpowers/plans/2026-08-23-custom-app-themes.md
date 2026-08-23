# Custom App Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flexible, persistent, application-only custom themes with system-font selection, semantic color token overrides, named profiles, light/dark variants, import/export, and contrast validation while keeping reader typography settings independent.

**Architecture:** Keep the existing `theme` setting as the active theme id and add a generated `theme_profiles` JSON setting for custom profiles. A pure TypeScript theme model validates and merges sparse token overrides, while the theme runtime applies only a registered set of CSS variables and font values to the root element. A settings manager edits profiles through Vue events and emits the serialized settings object through the existing debounced auto-save flow.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Pinia, Vitest/Vue Test Utils, Go settings handler, schema-driven settings generator, existing CSS custom properties and Phosphor icons.

## Global Constraints

- Theme customization applies to the application shell and reader surfaces; article typography remains controlled by reading settings.
- Existing built-in `Paper`, `Ink`, `Sepia`, `High Contrast`, and `Auto` values remain backward compatible.
- Existing article custom CSS remains article-only; custom theme data never executes CSS or scripts.
- Font values come only from detected system fonts or the supported generic stacks.
- Use the existing settings REST API and schema generator; do not add a second persistence service.
- Write tests before production code for every new behavior and keep changed behavior covered one-to-one.
- Preserve unrelated dirty worktree changes and stage only files belonging to each task.

---

### Task 1: Add Themed Profile Persistence Schema

**Files:**
- Modify: `internal/config/settings_schema.json`
- Modify (generated): `config/defaults.json`, `internal/config/defaults.json`, `internal/config/config.go`, `internal/config/settings_keys.go`, `internal/handlers/settings/settings_base.go`, `frontend/src/types/settings.generated.ts`, `frontend/src/composables/core/useSettings.generated.ts`
- Test: `internal/handlers/settings/settings_handlers_test.go`

**Interfaces:**
- Produces `SettingsData.theme_profiles: string` with default `"[]"`.
- Produces a backend setting key named `theme_profiles` accepted by GET/POST `/api/settings`.

- [ ] **Step 1: Write the failing settings API test**

Add a test that posts `theme_profiles` containing a valid JSON profile array, then verifies the GET response returns the exact serialized value and that an empty array (`"[]"`) is persisted for deleting all profiles.

```go
func TestHandleSettingsThemeProfilesRoundTrip(t *testing.T) {
	h := setupHandlerWithDB(t)
	profileJSON := `[{"id":"custom-1","name":"Focus","basePreset":"ink","appearance":"dark","light":{},"dark":{},"uiFontFamily":"system","uiFontSize":16,"updatedAt":"2026-08-23T00:00:00.000Z"}]`
	payload, err := json.Marshal(map[string]string{"theme_profiles": profileJSON})
	if err != nil { t.Fatal(err) }
	post := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(payload))
	post.Header.Set("Content-Type", "application/json")
	postResponse := httptest.NewRecorder()
	HandleSettings(h, postResponse, post)
	if postResponse.Code != http.StatusOK { t.Fatalf("POST status = %d", postResponse.Code) }

	getResponse := httptest.NewRecorder()
	HandleSettings(h, httptest.NewRequest(http.MethodGet, "/api/settings", nil), getResponse)
	var got map[string]string
	if err := json.NewDecoder(getResponse.Body).Decode(&got); err != nil { t.Fatal(err) }
	if got["theme_profiles"] != profileJSON {
		t.Fatalf("theme_profiles = %q, want %q", got["theme_profiles"], profileJSON)
	}
	emptyPayload, _ := json.Marshal(map[string]string{"theme_profiles": "[]"})
	emptyPost := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(emptyPayload))
	emptyPost.Header.Set("Content-Type", "application/json")
	emptyResponse := httptest.NewRecorder()
	HandleSettings(h, emptyResponse, emptyPost)
	if emptyResponse.Code != http.StatusOK { t.Fatalf("empty POST status = %d", emptyResponse.Code) }
	if value, _ := h.DB.GetSetting("theme_profiles"); value != "[]" {
		t.Fatal("expected empty profile array to remain persisted")
	}
}
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `go test ./internal/handlers/settings -run TestHandleSettingsThemeProfilesRoundTrip -v`.
Expected: FAIL because `theme_profiles` is not generated or returned by the settings definition.

- [ ] **Step 3: Add the schema entry and regenerate code**

Insert this entry in `internal/config/settings_schema.json`:

```json
"theme_profiles": {
  "type": "string",
  "default": "[]",
  "category": "general",
  "encrypted": false,
  "frontend_key": "themeProfiles"
}
```

Run `go run tools/settings-generator/main.go` from the repository root and confirm the generated files contain the new key and `SettingsData.theme_profiles` is a string.

- [ ] **Step 4: Run the focused test and verify it passes**

Run `go test ./internal/handlers/settings -run TestHandleSettingsThemeProfilesRoundTrip -v`.
Expected: PASS.

- [ ] **Step 5: Commit the schema change**

```bash
git add internal/config/settings_schema.json config/defaults.json internal/config/defaults.json internal/config/config.go internal/config/settings_keys.go internal/handlers/settings/settings_base.go frontend/src/types/settings.generated.ts frontend/src/composables/core/useSettings.generated.ts internal/handlers/settings/settings_handlers_test.go
git commit -m "feat(settings): persist custom theme profiles"
```

### Task 2: Build the Pure Custom Theme Model

**Files:**
- Create: `frontend/src/types/theme.ts`
- Create: `frontend/src/utils/customTheme.ts`
- Create: `frontend/src/utils/customTheme.test.ts`
- Modify: `frontend/src/utils/theme.ts`
- Modify: `frontend/src/utils/theme.test.ts`

**Interfaces:**
- `ThemeTokenKey`, `ThemeTokenOverrides`, `CustomThemeProfile`, and `ThemeProfilesDocument` are exported from `types/theme.ts`.
- `ThemeProfilesDocument` is `{ version: 1; profiles: CustomThemeProfile[] }`, and `ThemeContrastReport` is `{ primary: ContrastCheck; secondary: ContrastCheck; accent: ContrastCheck; states: ContrastCheck[] }` where each `ContrastCheck` has `foreground`, `background`, `ratio`, and `passes`.
- `BuiltInThemePreset` is the existing `ThemePreset` union without `auto`; `ThemeTokenOverrides` is `Partial<Record<ThemeTokenKey, string>>` and keys never include the leading `--`.
- `parseThemeProfiles(raw: unknown): CustomThemeProfile[]` returns only validated profiles.
- `serializeThemeProfiles(profiles: CustomThemeProfile[]): string` returns a stable JSON array.
- `ThemeProfilesDocument` has `version: 1` and `profiles: CustomThemeProfile[]` for import/export files.
- `mergeThemeTokens(base: Record<ThemeTokenKey, string>, overrides: ThemeTokenOverrides): Record<ThemeTokenKey, string>` applies only registered keys.
- `calculateContrastRatio(foreground: string, background: string): number` supports six- and eight-digit hex colors.
- `validateThemeContrast(tokens: Record<ThemeTokenKey, string>): ThemeContrastReport` reports primary, secondary, accent, and state pairs.
- `createCustomThemeProfile(name: string, basePreset: BuiltInThemePreset, font: string, size: number): CustomThemeProfile` creates a clean profile with empty overrides.

- [ ] **Step 1: Write failing model tests**

Cover these independent behaviors in `customTheme.test.ts`: reject malformed JSON and unknown token keys, normalize invalid names/font sizes, merge sparse overrides without mutating the base map, calculate `21` for black/white contrast, reject malformed colors, preserve valid eight-digit colors, and report a failing primary text pair.

```ts
it('keeps only registered token overrides when parsing profiles', () => {
  const profiles = parseThemeProfiles(JSON.stringify([{
    id: 'focus', name: 'Focus', basePreset: 'ink', appearance: 'dark',
    light: { 'text-primary': '#fff', '--not-allowed': '#000' },
    dark: {}, uiFontFamily: 'system', uiFontSize: 16, updatedAt: '2026-08-23T00:00:00.000Z'
  }]));

  expect(profiles[0].light).toEqual({ 'text-primary': '#fff' });
});
```

- [ ] **Step 2: Run the model tests and verify they fail**

Run `cd frontend && npm run test:unit -- src/utils/customTheme.test.ts`.
Expected: FAIL because the model module and exported functions do not exist.

- [ ] **Step 3: Implement the registry, validator, serializer, merge, and contrast functions**

Register these application semantic token keys: `bg-primary`, `bg-secondary`, `bg-tertiary`, `surface-rail`, `surface-panel`, `surface-hover`, `surface-selected`, `text-primary`, `text-secondary`, `text-tertiary`, `accent-color`, `accent-hover`, `accent-text-color`, `accent-foreground`, `selection-background`, `selection-color`, `border-color`, `mark-bg-color`, `table-stripe-color`, `code-bg-color`, `code-border-color`, all `syntax-*` keys, all `state-*-color/background/border` keys, `unread-badge-background`, `unread-badge-color`, `overlay-backdrop`, all `media-*` color keys, and `media-viewer-border`.

Normalize names to a trimmed maximum of 48 characters, clamp application font size to 12-20px, accept only `system`, generic stacks, or a font name returned by the existing detector, and cap serialized profiles at 512 KiB/20 profiles. Use a relative-luminance calculation for WCAG contrast and never throw on untrusted JSON.

Extend `theme.ts` with `clearCustomThemeOverrides(root?)`, `applyCustomTheme(profile, prefersDark, root?)`, and `getThemePreferenceId(profile)` while preserving the existing built-in behavior and legacy `light`/`dark` normalization.

- [ ] **Step 4: Run model and existing theme tests**

Run `cd frontend && npm run test:unit -- src/utils/customTheme.test.ts src/utils/theme.test.ts`.
Expected: all new and existing tests PASS.

- [ ] **Step 5: Commit the pure model**

```bash
git add frontend/src/types/theme.ts frontend/src/utils/customTheme.ts frontend/src/utils/customTheme.test.ts frontend/src/utils/theme.ts frontend/src/utils/theme.test.ts
git commit -m "feat(theme): add validated custom profile model"
```

### Task 3: Integrate Runtime Application and Startup Cache

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/stores/app.ts`
- Modify: `frontend/src/composables/core/useSettings.ts`
- Modify: `frontend/src/composables/core/useSettingsAutoSave.ts`
- Test: `frontend/src/App.test.ts`
- Create: `frontend/src/composables/core/useSettings.test.ts`

**Interfaces:**
- `applyThemePreference` continues to apply built-ins; `applyCustomTheme` overlays only registered variables and sets `--ui-font-family`/`--ui-font-size` from the active profile.
- `setTheme(preference: string, profiles?: CustomThemeProfile[])` applies the active profile when the preference is `custom:<id>`.
- `setSettingsFromRawData` parses and sanitizes `theme_profiles` without changing the reader settings fields.

- [ ] **Step 1: Write failing runtime tests**

Add tests proving a custom profile sets `data-theme-preset` to its base preset, writes a token and UI font to the root, clears those inline overrides when switching to `paper`, and that malformed cached profile data falls back to `paper` without throwing.

- [ ] **Step 2: Run the focused tests and verify the expected failures**

Run `cd frontend && npm run test:unit -- src/App.test.ts src/composables/core/useSettings.test.ts`.
Expected: FAIL on the new custom-profile assertions.

- [ ] **Step 3: Wire profile-aware theme application**

Keep `themePreference` as the single selection state, pass parsed profiles through `setTheme`, and update the `App.vue` root style effect so built-in themes use existing `ui_font_*` settings while custom themes use the profile font fields. Clear custom inline variables before every built-in application. Dispatch `theme-updated` with the resolved preset and profile id so previews and tests can observe changes.

- [ ] **Step 4: Extend the pre-mount startup script**

Read `themePreference` and a versioned `themeProfilesCache` localStorage value, validate primitive fields and token names in the small script, apply the base preset, then set only safe `--token` properties and UI font values. Keep the script dependency-free and fall back to `auto`/Paper on parse errors.

- [ ] **Step 5: Run focused tests and the frontend build**

Run `cd frontend && npm run test:unit -- src/App.test.ts src/composables/core/useSettings.test.ts && npm run build`.
Expected: PASS and a successful Vite production build.

- [ ] **Step 6: Commit runtime integration**

```bash
git add frontend/index.html frontend/src/App.vue frontend/src/stores/app.ts frontend/src/composables/core/useSettings.ts frontend/src/composables/core/useSettingsAutoSave.ts frontend/src/App.test.ts frontend/src/composables/core/useSettings.test.ts
git commit -m "feat(theme): apply custom profiles at runtime"
```

### Task 4: Implement Accessible Theme Profile Controls

**Files:**
- Create: `frontend/src/components/settings/ThemeColorField.vue`
- Create: `frontend/src/components/settings/CustomThemeManager.vue`
- Create: `frontend/src/components/settings/CustomThemeManager.test.ts`
- Modify: `frontend/src/components/modals/settings/general/ApplicationSettings.vue`
- Modify: `frontend/src/components/modals/settings/general/GeneralTab.vue`

**Interfaces:**
- `CustomThemeManager` accepts `settings: SettingsData` and emits `update:settings: SettingsData`.
- `ThemeColorField` accepts `modelValue`, `label`, `description`, and `inheritedValue`, and emits `update:modelValue: string | undefined`.
- Manager edits the serialized `settings.theme_profiles` value and active `settings.theme` without touching `content_font_*`, `content_line_height`, or reader width settings.

- [ ] **Step 1: Write failing component tests**

Test rendering of the empty state, creating a named profile from Paper, activating it, editing a token, switching light/dark editing modes, resetting one token, duplicating and deleting a profile, and the required `radiogroup`/`tablist` labels. Test that profile font changes do not mutate `content_font_family` or `content_font_size`.

```ts
it('updates only application theme data when a profile color changes', async () => {
  const wrapper = mount(CustomThemeManager, { props: { settings: settingsFixture } });
  await wrapper.get('[data-action="new-theme"]').trigger('click');
  await wrapper.get('[data-token="accent-color"] input[type="text"]').setValue('#ff5500');
  const emitted = wrapper.emitted('update:settings')?.at(-1)?.[0] as SettingsData;
  expect(JSON.parse(emitted.theme_profiles)[0].light['accent-color']).toBe('#ff5500');
  expect(emitted.content_font_family).toBe(settingsFixture.content_font_family);
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run `cd frontend && npm run test:unit -- src/components/settings/CustomThemeManager.test.ts`.
Expected: FAIL because the manager and color field components do not exist.

- [ ] **Step 3: Implement the color field**

Render a native color input for six-digit colors plus a text input for six/eight-digit hex values, show inherited values when no override exists, expose a reset button with an accessible name, and mark invalid values without writing them to the profile.

- [ ] **Step 4: Implement profile lifecycle and editor**

Use the existing `FontFamilySelect` for detected system fonts, a bounded `NumberControl` for 12-20px, a profile list with activate/duplicate/rename/delete actions, light/dark/auto controls, grouped token fields from the registry, contrast report, and import/export controls. Use a native hidden file input and Blob download; imported documents must pass `parseThemeProfiles` before emission. Keep all controls keyboard reachable and use semantic state text in addition to swatches.

- [ ] **Step 5: Mount the manager without merging reading settings**

Place the manager below the built-in selector in `ApplicationSettings.vue`. Keep the existing global application font controls as the fallback for built-ins and label custom profile font controls separately. Do not move or alter the reading typography components.

- [ ] **Step 6: Run component tests and formatting**

Run `cd frontend && npm run test:unit -- src/components/settings/CustomThemeManager.test.ts src/components/settings/ThemePresetPicker.test.ts && npx prettier --check src/components/settings/ThemeColorField.vue src/components/settings/CustomThemeManager.vue src/components/settings/CustomThemeManager.test.ts src/components/modals/settings/general/ApplicationSettings.vue src/components/modals/settings/general/GeneralTab.vue`.
Expected: PASS with no formatting changes required.

- [ ] **Step 7: Commit the editor**

```bash
git add frontend/src/components/settings/ThemeColorField.vue frontend/src/components/settings/CustomThemeManager.vue frontend/src/components/settings/CustomThemeManager.test.ts frontend/src/components/modals/settings/general/ApplicationSettings.vue frontend/src/components/modals/settings/general/GeneralTab.vue
git commit -m "feat(settings): add custom theme editor"
```

### Task 5: Add Localized Copy and Server-Side Validation

**Files:**
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Modify: `internal/handlers/settings/settings_handlers.go`
- Modify: `internal/handlers/settings/settings_handlers_test.go`

**Interfaces:**
- UI copy covers profile lifecycle, token groups, contrast warnings, import/export, invalid data, and fallback behavior in English and Simplified Chinese.
- POST `/api/settings` returns `400` for malformed/oversized `theme_profiles`, while valid arrays and `[]` continue to round-trip.

- [ ] **Step 1: Write failing backend validation tests**

Add table-driven tests for malformed JSON, an object instead of an array, more than 20 profiles, a profile with a non-hex token, and a payload over 512 KiB. Assert HTTP 400 and unchanged stored data for each invalid request.

- [ ] **Step 2: Run the tests and verify they fail**

Run `go test ./internal/handlers/settings -run 'TestHandleSettingsThemeProfiles' -v`.
Expected: FAIL because the generic settings handler currently accepts any string.

- [ ] **Step 3: Implement bounded validation before SaveSettings**

Parse the `theme_profiles` payload into `[]json.RawMessage`, enforce the byte/profile limits, validate required scalar fields and the exact allowlist (`bg-*`, `surface-*`, `text-*`, `accent-*`, `selection-*`, `border-color`, `mark-bg-color`, `table-stripe-color`, `code-*`, `syntax-*`, `state-{favorite,read-later,info,success,warning,danger}-{color,background,border}`, `unread-badge-{background,color}`, `overlay-backdrop`, and the registered `media-*` color keys), and return a descriptive 400 response before writing to the database. Keep all other settings behavior unchanged.

- [ ] **Step 4: Add localized translations and update labels**

Add matching `setting.general.customTheme.*` keys to both locale files. Replace hard-coded editor labels with `t()` calls and ensure validation messages are readable at compact settings widths.

- [ ] **Step 5: Run backend and frontend focused tests**

Run `go test ./internal/handlers/settings -run 'TestHandleSettingsThemeProfiles' -v` and `cd frontend && npm run test:unit -- src/components/settings/CustomThemeManager.test.ts`.
Expected: PASS.

- [ ] **Step 6: Commit validation and copy**

```bash
git add frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/zh.ts internal/handlers/settings/settings_handlers.go internal/handlers/settings/settings_handlers_test.go
git commit -m "feat(theme): validate and localize custom profiles"
```

### Task 6: End-to-End Verification and Documentation

**Files:**
- Modify: `docs/SETTINGS.md` (add the custom application theme section)
- Test: `frontend/src/utils/theme.test.ts`, `frontend/src/components/settings/CustomThemeManager.test.ts`, browser verification script outside the repository if needed

**Interfaces:**
- Documentation describes the separation between application themes and reader typography/custom CSS, supported system-font behavior, profile storage, and recovery rules.

- [ ] **Step 1: Extend token contract tests**

Assert every registered editable token exists in the Paper, Ink, Sepia, and High Contrast CSS blocks and that switching from a custom profile back to a built-in leaves no inline custom token properties.

- [ ] **Step 2: Run the complete frontend test suite**

Run `cd frontend && npm run test:unit`.
Expected: all existing and new tests pass.

- [ ] **Step 3: Run static checks and production build**

Run `cd frontend && npx eslint src/types/theme.ts src/utils/customTheme.ts src/utils/theme.ts src/components/settings/ThemeColorField.vue src/components/settings/CustomThemeManager.vue src/components/settings/CustomThemeManager.test.ts src/components/modals/settings/general/ApplicationSettings.vue && npx prettier --check src/types/theme.ts src/utils/customTheme.ts src/utils/theme.ts src/components/settings/ThemeColorField.vue src/components/settings/CustomThemeManager.vue src/components/settings/CustomThemeManager.test.ts src/components/modals/settings/general/ApplicationSettings.vue src/i18n/locales/en.ts src/i18n/locales/zh.ts && npm run build`.
Expected: exit 0; only the existing large-chunk build warning may remain.

- [ ] **Step 4: Run backend and repository checks**

Run `go test -timeout=5m ./...` and `git diff --check`.
Expected: all Go packages pass and no whitespace errors appear.

- [ ] **Step 5: Browser-verify the critical journeys**

Against `http://127.0.0.1:5174`, verify at desktop and 390px widths: create two profiles, edit a light and dark token, switch system mode, select a detected font, reload and confirm persistence, duplicate/rename/delete, export/import, reject an invalid import, and confirm content font controls remain unchanged. Capture Paper, Ink, Sepia, High Contrast, and at least one custom profile; run the scoped accessibility scan.

- [ ] **Step 6: Update settings documentation and commit**

Document the supported token groups, contrast rule, import/export format, and fallback behavior in `docs/SETTINGS.md`, then run `git diff --check` once more and commit:

```bash
git add docs/SETTINGS.md frontend/src/utils/theme.test.ts frontend/src/components/settings/CustomThemeManager.test.ts
git commit -m "docs(theme): document custom app themes"
```
