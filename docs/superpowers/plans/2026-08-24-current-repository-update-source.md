# Current Repository Update Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route update checking, update-download validation, manual-update links, and package metadata to the current `tanzv/MrRSS` repository.

**Architecture:** Centralize the backend repository/release endpoints in the update handler package so checking and validating updates cannot drift. Use a small frontend repository-link module for the About tab and no-installer dialog. Existing release parsing, downloads, install flow, and proxy behavior remain unchanged.

**Tech Stack:** Go 1.25, net/http, Vue 3.5, TypeScript, Vitest, Vue Test Utils, Cypress fixtures, Wails v3.

## Global Constraints

- The canonical repository is `https://github.com/tanzv/MrRSS`; the releases API is `https://api.github.com/repos/tanzv/MrRSS/releases`.
- Only release assets below `https://github.com/tanzv/MrRSS/releases/download/` are valid download targets.
- Do not weaken the update URL allowlist, introduce redirects to arbitrary hosts, change release selection rules, alter proxy handling, or change installer execution behavior.
- Preserve unrelated links, documentation, scripts, and dirty user changes outside the files named below.
- For each behavior, add or alter its focused test first and observe its expected failure before implementation.
- Do not stage, reset, clean, or commit implementation files in the shared worktree.

---

## File Structure

- `internal/handlers/update/update_source.go`: Canonical GitHub repository, releases API, releases-latest, asset prefix, and URL validator used by update handlers.
- `internal/handlers/update/update_source_test.go`: Validates that the current repository’s release asset URL is accepted and previous/host-confusion URLs are rejected.
- `internal/handlers/update/update_check_handlers.go`: Uses the shared GitHub releases API endpoint.
- `internal/handlers/update/update_download_handlers.go`: Uses the shared source validator before downloading.
- `internal/handlers/update/download_handlers_test.go`: Sends current-repository URLs through the real download handler’s validation path.
- `frontend/src/config/repository.ts`: Canonical frontend repository and latest-release links.
- `frontend/src/components/modals/settings/about/AboutTab.vue`: Opens canonical repository and releases links.
- `frontend/src/components/modals/settings/about/AboutTab.test.ts`: Verifies the visible repo/fallback buttons use canonical URLs.
- `frontend/src/components/modals/update/UpdateAvailableDialog.vue`: Uses canonical latest-releases fallback link.
- `frontend/src/components/modals/update/UpdateAvailableDialog.test.ts`: Verifies no-installer fallback renders the canonical release URL.
- `frontend/cypress/e2e/auto-update.cy.ts`: Uses a canonical release asset fixture.
- `build/darwin/create-dmg.sh`, `build/linux/create-appimage.sh`, `build/windows/installer.nsi`: Package homepage metadata points to the current repository.

## Task 1: Centralize and Enforce the Backend Release Source

**Files:**
- Create: `internal/handlers/update/update_source.go`
- Create: `internal/handlers/update/update_source_test.go`
- Modify: `internal/handlers/update/update_check_handlers.go`
- Modify: `internal/handlers/update/update_download_handlers.go`
- Modify: `internal/handlers/update/download_handlers_test.go`

**Interfaces:**
- `githubReleasesAPIURL`, `githubRepositoryURL`, `githubReleasesLatestURL`, and `githubReleaseAssetURLPrefix` are package constants based on `tanzv/MrRSS`.
- `isOfficialReleaseAssetURL(value string) bool` accepts only HTTPS URLs whose exact host is `github.com` and whose path begins `/tanzv/MrRSS/releases/download/`.
- `HandleCheckUpdates` reads `githubReleasesAPIURL`; `HandleDownloadUpdate` calls `isOfficialReleaseAssetURL`.

- [ ] **Step 1: Write the failing backend tests for the canonical asset boundary**

```go
func TestIsOfficialReleaseAssetURLAcceptsOnlyCurrentRepositoryAssets(t *testing.T) {
    cases := []struct {
        name string
        value string
        want bool
    }{
        {"current release asset", "https://github.com/tanzv/MrRSS/releases/download/v1.3.26/MrRSS-1.3.26-darwin-universal.dmg", true},
        {"previous repository", "https://github.com/DevXDojo/MrRSS/releases/download/v1/app.zip", false},
        {"lookalike host", "https://github.com.tanzv.example/MrRSS/releases/download/v1/app.zip", false},
        {"wrong path", "https://github.com/tanzv/MrRSS/releases/latest", false},
    }

    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            if got := isOfficialReleaseAssetURL(tc.value); got != tc.want {
                t.Fatalf("isOfficialReleaseAssetURL(%q) = %v, want %v", tc.value, got, tc.want)
            }
        })
    }
}
```

Change the existing invalid-asset-name handler fixture to use the current repository asset URL. It should still reach asset-name validation and return 400.

```go
if !strings.Contains(rr.Body.String(), "invalid asset name") {
    t.Fatalf("expected asset validation response, got %s", rr.Body.String())
}
```

- [ ] **Step 2: Run the focused Go tests and verify they fail because the source helper does not exist**

Run: `go test -v ./internal/handlers/update -run 'Test(IsOfficialReleaseAssetURLAcceptsOnlyCurrentRepositoryAssets|HandleDownloadUpdate)'`

Expected: FAIL with an undefined `isOfficialReleaseAssetURL` symbol.

- [ ] **Step 3: Implement the centralized source and use it from both handlers**

```go
package update

import (
    "net/url"
    "strings"
)

const githubRepository = "tanzv/MrRSS"
const githubRepositoryURL = "https://github.com/" + githubRepository
const githubReleasesAPIURL = "https://api.github.com/repos/" + githubRepository + "/releases"
const githubReleasesLatestURL = githubRepositoryURL + "/releases/latest"
const githubReleaseAssetURLPrefix = githubRepositoryURL + "/releases/download/"

func isOfficialReleaseAssetURL(value string) bool {
    parsed, err := url.Parse(value)
    if err != nil || parsed.Scheme != "https" || parsed.Host != "github.com" {
        return false
    }
    return strings.HasPrefix(parsed.Path, "/tanzv/MrRSS/releases/download/")
}
```

Replace the function-local `githubAPI` in `HandleCheckUpdates` with `githubReleasesAPIURL`. Replace the old string-prefix guard in `HandleDownloadUpdate` with `if !isOfficialReleaseAssetURL(req.DownloadURL) { ... }`; retain the existing log/error/status behavior.

- [ ] **Step 4: Run the focused Go tests and verify they pass**

Run: `go test -v ./internal/handlers/update -run 'Test(IsOfficialReleaseAssetURLAcceptsOnlyCurrentRepositoryAssets|HandleDownloadUpdate)'`

Expected: PASS.

- [ ] **Step 5: Format and run the package test**

Run: `gofmt -w internal/handlers/update/update_source.go internal/handlers/update/update_source_test.go internal/handlers/update/update_check_handlers.go internal/handlers/update/update_download_handlers.go internal/handlers/update/download_handlers_test.go && go test -v ./internal/handlers/update`

Expected: no formatting diff and PASS.

## Task 2: Route Manual Update UI to the Same Repository

**Files:**
- Create: `frontend/src/config/repository.ts`
- Create: `frontend/src/components/modals/settings/about/AboutTab.test.ts`
- Create: `frontend/src/components/modals/update/UpdateAvailableDialog.test.ts`
- Modify: `frontend/src/components/modals/settings/about/AboutTab.vue`
- Modify: `frontend/src/components/modals/update/UpdateAvailableDialog.vue`
- Modify: `frontend/cypress/e2e/auto-update.cy.ts`

**Interfaces:**
- `repositoryURL` is `https://github.com/tanzv/MrRSS`.
- `latestReleaseURL` is `${repositoryURL}/releases/latest`.
- About and fallback controls import the values rather than duplicate URL literals.

- [ ] **Step 1: Write the failing UI tests for repository and no-installer fallback links**

```ts
vi.mock('@/utils/browser', () => ({ openInBrowser: vi.fn() }));

it('opens the current repository from the visible GitHub action', async () => {
  const wrapper = mountAboutTab();

  await wrapper.get('[data-testid="about-repository-link"]').trigger('click');

  expect(openInBrowser).toHaveBeenCalledWith('https://github.com/tanzv/MrRSS');
});

it('opens the current repository latest release when its About fallback is selected', async () => {
  const wrapper = mountAboutTab({
    updateInfo: { has_update: true, current_version: '1.0.0', latest_version: '1.1.0' },
  });

  await wrapper.get('[data-testid="about-manual-update-link"]').trigger('click');

  expect(openInBrowser).toHaveBeenCalledWith(
    'https://github.com/tanzv/MrRSS/releases/latest'
  );
});

it('renders the current repository latest release when no installer is available', () => {
  const wrapper = mount(UpdateAvailableDialog, {
    props: { updateInfo: { has_update: true, current_version: '1.0.0', latest_version: '1.1.0' } },
    global,
  });

  expect(wrapper.get('[data-testid="manual-update-link"]').attributes('href')).toBe(
    'https://github.com/tanzv/MrRSS/releases/latest'
  );
});
```

Use an i18n mount helper and mock `/api/version` in the About-tab test so the real visible button behavior is exercised. Add the two test IDs only to the two user-facing controls named above.

- [ ] **Step 2: Run focused UI tests and verify they fail because the module, test IDs, and current URLs are absent**

Run: `cd frontend && npm run test:unit -- src/components/modals/settings/about/AboutTab.test.ts src/components/modals/update/UpdateAvailableDialog.test.ts`

Expected: FAIL because current components still point to `DevXDojo/MrRSS` and do not expose the test IDs.

- [ ] **Step 3: Implement a shared frontend link module and use it**

```ts
export const repositoryURL = 'https://github.com/tanzv/MrRSS';
export const latestReleaseURL = `${repositoryURL}/releases/latest`;
```

Import both constants in `AboutTab.vue`; use `repositoryURL` for `openGitHubRepo`, `latestReleaseURL` for `openGitHubRelease`, add `data-testid="about-repository-link"` to the persistent GitHub button, and add `data-testid="about-manual-update-link"` to its no-installer fallback button. Import `latestReleaseURL` in `UpdateAvailableDialog.vue`, bind it to the fallback anchor’s `href`, and add `data-testid="manual-update-link"` to that anchor. Update the Cypress `mockUpdateInfo.download_url` to the new owner URL.

- [ ] **Step 4: Run focused UI tests and verify they pass**

Run: `cd frontend && npm run test:unit -- src/components/modals/settings/about/AboutTab.test.ts src/components/modals/update/UpdateAvailableDialog.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the targeted frontend lint checkpoint**

Run: `cd frontend && npx eslint src/config/repository.ts src/components/modals/settings/about/AboutTab.vue src/components/modals/settings/about/AboutTab.test.ts src/components/modals/update/UpdateAvailableDialog.vue src/components/modals/update/UpdateAvailableDialog.test.ts`

Expected: exit code 0.

## Task 3: Align Release Package Metadata and Verify the Built App

**Files:**
- Modify: `build/darwin/create-dmg.sh`
- Modify: `build/linux/create-appimage.sh`
- Modify: `build/windows/installer.nsi`
- Verify: `build/bin/MrRSS.app`
- Install: `/Applications/MrRSS.app`

- [ ] **Step 1: Change only each package homepage value to the canonical repository**

```sh
APP_URL="https://github.com/tanzv/MrRSS"
```

In `build/windows/installer.nsi`, use `!define APP_URL "https://github.com/tanzv/MrRSS"`. Do not alter package IDs, versioning, assets, build commands, or signing behavior.

- [ ] **Step 2: Confirm package metadata has no old owner references**

Run: `rg -n 'DevXDojo/MrRSS' build/darwin/create-dmg.sh build/linux/create-appimage.sh build/windows/installer.nsi`

Expected: no output.

- [ ] **Step 3: Run focused and full verification**

Run:

```sh
go test -v ./internal/handlers/update
cd frontend && npm run test:unit -- src/components/modals/settings/about/AboutTab.test.ts src/components/modals/update/UpdateAvailableDialog.test.ts && npm run build
cd .. && go test -v -timeout=5m ./... && wails3 build && git diff --check
```

Expected: every command exits 0 and the build produces `build/bin/MrRSS.app`.

- [ ] **Step 4: Install the verified app safely**

Quit a running `/Applications/MrRSS.app` if necessary. Move the existing app to a distinct dated backup under `/Applications/`, copy the verified `build/bin/MrRSS.app` into `/Applications/MrRSS.app`, then compare a deterministic file hash within the source and installed bundles.

Expected: `/Applications/MrRSS.app` is the verified new build; the prior app remains recoverable in the dated backup.

- [ ] **Step 5: Record the final working-tree state**

Run: `git status --short`

Expected: pre-existing package-file changes remain untouched; any implementation changes are limited to the planned paths.
