package version

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"testing"
)

func TestDesktopReleaseMetadataMatchesApplicationVersion(t *testing.T) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate release metadata test")
	}

	repositoryRoot := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", ".."))
	testCases := []struct {
		name    string
		path    string
		pattern string
		want    string
	}{
		{"frontend package", "frontend/package.json", `"version"\s*:\s*"([^"]+)"`, Version},
		{"build config", "build/config.yml", `(?m)^\s*version:\s*"([^"]+)"\s*# The application version`, Version},
		{"darwin Info.plist bundle", "build/darwin/Info.plist", `(?s)<key>CFBundleVersion</key>\s*<string>([^<]+)</string>`, Version},
		{"darwin Info.plist short", "build/darwin/Info.plist", `(?s)<key>CFBundleShortVersionString</key>\s*<string>([^<]+)</string>`, Version},
		{"darwin Taskfile bundle", "build/darwin/Taskfile.yml", `(?s)<key>CFBundleVersion</key>\s*<string>([^<]+)</string>`, Version},
		{"darwin Taskfile short", "build/darwin/Taskfile.yml", `(?s)<key>CFBundleShortVersionString</key>\s*<string>([^<]+)</string>`, Version},
		{"windows file info", "build/windows/info.json", `"file_version"\s*:\s*"([^"]+)"`, Version},
		{"windows product info", "build/windows/info.json", `"ProductVersion"\s*:\s*"([^"]+)"`, Version},
		{"windows installer", "build/windows/installer.nsi", `!define APP_VERSION "([^"]+)"`, Version},
		{"windows manifest", "build/windows/wails.exe.manifest", `version="([^"]+)" processorArchitecture`, Version + ".0"},
		{"windows Wails tools", "build/windows/nsis/wails_tools.nsh", `!define INFO_PRODUCTVERSION "([^"]+)"`, Version},
		{"linux package", "build/linux/nfpm/nfpm.yaml", `(?m)^version:\s*"([^"]+)"`, Version},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			contents, err := os.ReadFile(filepath.Join(repositoryRoot, testCase.path))
			if err != nil {
				t.Fatalf("read %s: %v", testCase.path, err)
			}

			matches := regexp.MustCompile(testCase.pattern).FindStringSubmatch(string(contents))
			if len(matches) != 2 {
				t.Fatalf("find version in %s", testCase.path)
			}
			if matches[1] != testCase.want {
				t.Errorf("%s version = %q, want %q", testCase.path, matches[1], testCase.want)
			}
		})
	}
}
