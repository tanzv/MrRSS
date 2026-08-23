package settings

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	maxCustomThemeProfiles  = 20
	maxCustomThemeBytes     = 512 * 1024
	maxCustomThemeNameRunes = 48
	minCustomThemeFontSize  = 12
	maxCustomThemeFontSize  = 20
)

var (
	customThemeIDPattern    = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`)
	customThemeColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$`)
)

var customThemePresets = map[string]struct{}{
	"paper":         {},
	"ink":           {},
	"sepia":         {},
	"high-contrast": {},
}

var customThemeProfileFields = map[string]struct{}{
	"id":           {},
	"name":         {},
	"basePreset":   {},
	"appearance":   {},
	"light":        {},
	"dark":         {},
	"uiFontFamily": {},
	"uiFontSize":   {},
	"updatedAt":    {},
}

var customThemeDocumentFields = map[string]struct{}{
	"version":  {},
	"profiles": {},
}

var customThemeTokenKeys = map[string]struct{}{
	"bg-primary":                      {},
	"bg-secondary":                    {},
	"bg-tertiary":                     {},
	"surface-rail":                    {},
	"surface-panel":                   {},
	"surface-hover":                   {},
	"surface-selected":                {},
	"text-primary":                    {},
	"text-secondary":                  {},
	"text-tertiary":                   {},
	"accent-color":                    {},
	"accent-hover":                    {},
	"accent-text-color":               {},
	"accent-foreground":               {},
	"selection-background":            {},
	"selection-color":                 {},
	"border-color":                    {},
	"mark-bg-color":                   {},
	"table-stripe-color":              {},
	"code-bg-color":                   {},
	"code-border-color":               {},
	"syntax-plain":                    {},
	"syntax-comment":                  {},
	"syntax-keyword":                  {},
	"syntax-string":                   {},
	"syntax-title":                    {},
	"syntax-attribute":                {},
	"syntax-meta":                     {},
	"syntax-built-in":                 {},
	"syntax-formula-background":       {},
	"state-favorite-color":            {},
	"state-favorite-background":       {},
	"state-favorite-border":           {},
	"state-read-later-color":          {},
	"state-read-later-background":     {},
	"state-read-later-border":         {},
	"state-info-color":                {},
	"state-info-background":           {},
	"state-info-border":               {},
	"state-success-color":             {},
	"state-success-background":        {},
	"state-success-border":            {},
	"state-warning-color":             {},
	"state-warning-background":        {},
	"state-warning-border":            {},
	"state-danger-color":              {},
	"state-danger-background":         {},
	"state-danger-border":             {},
	"unread-badge-background":         {},
	"unread-badge-color":              {},
	"overlay-backdrop":                {},
	"media-overlay-background":        {},
	"media-overlay-hover-background":  {},
	"media-overlay-strong-background": {},
	"media-overlay-foreground":        {},
	"media-overlay-muted-foreground":  {},
	"media-control-background":        {},
	"media-control-hover-background":  {},
	"media-control-foreground":        {},
	"media-badge-background":          {},
	"media-badge-foreground":          {},
	"media-viewer-background":         {},
	"media-viewer-border":             {},
}

// validateThemeProfilesJSON validates the persisted profile document without
// normalizing it. The frontend owns normalization; the API only accepts safe,
// bounded data and preserves valid JSON byte-for-byte.
func validateThemeProfilesJSON(raw string) error {
	if len([]byte(raw)) > maxCustomThemeBytes {
		return fmt.Errorf("theme_profiles exceeds %d bytes", maxCustomThemeBytes)
	}

	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return fmt.Errorf("theme_profiles must be valid JSON: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("theme_profiles must contain one JSON value")
		}
		return fmt.Errorf("theme_profiles contains trailing data: %w", err)
	}

	profiles, err := extractThemeProfiles(value)
	if err != nil {
		return err
	}
	if len(profiles) > maxCustomThemeProfiles {
		return fmt.Errorf("theme_profiles supports at most %d profiles", maxCustomThemeProfiles)
	}

	seenIDs := make(map[string]struct{}, len(profiles))
	for index, profileValue := range profiles {
		profile, ok := profileValue.(map[string]any)
		if !ok {
			return fmt.Errorf("theme_profiles[%d] must be an object", index)
		}
		if err := validateThemeProfile(index, profile, seenIDs); err != nil {
			return err
		}
	}

	return nil
}

func extractThemeProfiles(value any) ([]any, error) {
	switch typed := value.(type) {
	case []any:
		return typed, nil
	case map[string]any:
		for key := range typed {
			if _, ok := customThemeDocumentFields[key]; !ok {
				return nil, fmt.Errorf("theme_profiles document contains unknown field %q", key)
			}
		}
		version, ok := typed["version"].(json.Number)
		if !ok || version.String() != "1" {
			return nil, fmt.Errorf("theme_profiles document version must be 1")
		}
		profiles, ok := typed["profiles"].([]any)
		if !ok {
			return nil, fmt.Errorf("theme_profiles.profiles must be an array")
		}
		return profiles, nil
	default:
		return nil, fmt.Errorf("theme_profiles must be an array or versioned document")
	}
}

func validateThemeProfile(index int, profile map[string]any, seenIDs map[string]struct{}) error {
	for key := range profile {
		if _, ok := customThemeProfileFields[key]; !ok {
			return fmt.Errorf("theme_profiles[%d] contains unknown field %q", index, key)
		}
	}

	for _, key := range []string{
		"id",
		"name",
		"basePreset",
		"appearance",
		"light",
		"dark",
		"uiFontFamily",
		"uiFontSize",
		"updatedAt",
	} {
		if _, ok := profile[key]; !ok {
			return fmt.Errorf("theme_profiles[%d].%s is required", index, key)
		}
	}

	if rawID, ok := profile["id"]; ok {
		id, ok := rawID.(string)
		if !ok || !customThemeIDPattern.MatchString(id) {
			return fmt.Errorf("theme_profiles[%d].id is invalid", index)
		}
		if _, exists := seenIDs[id]; exists {
			return fmt.Errorf("theme_profiles contains duplicate profile id %q", id)
		}
		seenIDs[id] = struct{}{}
	}

	if rawName, ok := profile["name"]; ok {
		name, ok := rawName.(string)
		if !ok || strings.TrimSpace(name) == "" || utf8.RuneCountInString(name) > maxCustomThemeNameRunes {
			return fmt.Errorf("theme_profiles[%d].name is invalid", index)
		}
	}

	if rawPreset, ok := profile["basePreset"]; ok {
		preset, ok := rawPreset.(string)
		if !ok {
			return fmt.Errorf("theme_profiles[%d].basePreset is invalid", index)
		}
		if _, valid := customThemePresets[preset]; !valid {
			return fmt.Errorf("theme_profiles[%d].basePreset is unsupported", index)
		}
	}

	if rawAppearance, ok := profile["appearance"]; ok {
		appearance, ok := rawAppearance.(string)
		if !ok || (appearance != "light" && appearance != "dark" && appearance != "auto") {
			return fmt.Errorf("theme_profiles[%d].appearance is invalid", index)
		}
	}

	for _, variant := range []string{"light", "dark"} {
		if rawOverrides, ok := profile[variant]; ok {
			if err := validateThemeOverrides(index, variant, rawOverrides); err != nil {
				return err
			}
		}
	}

	if rawFont, ok := profile["uiFontFamily"]; ok {
		font, ok := rawFont.(string)
		if !ok || !validThemeFontFamily(font) {
			return fmt.Errorf("theme_profiles[%d].uiFontFamily is invalid", index)
		}
	}

	if rawSize, ok := profile["uiFontSize"]; ok {
		size, ok := rawSize.(json.Number)
		if !ok {
			return fmt.Errorf("theme_profiles[%d].uiFontSize must be a number", index)
		}
		numericSize, err := size.Float64()
		if err != nil || math.IsNaN(numericSize) || math.IsInf(numericSize, 0) ||
			math.Trunc(numericSize) != numericSize || numericSize < minCustomThemeFontSize || numericSize > maxCustomThemeFontSize {
			return fmt.Errorf("theme_profiles[%d].uiFontSize is outside %d-%d", index, minCustomThemeFontSize, maxCustomThemeFontSize)
		}
	}

	if rawUpdatedAt, ok := profile["updatedAt"]; ok {
		updatedAt, ok := rawUpdatedAt.(string)
		if !ok || utf8.RuneCountInString(updatedAt) > 128 || strings.TrimSpace(updatedAt) == "" {
			return fmt.Errorf("theme_profiles[%d].updatedAt is invalid", index)
		}
	}

	return nil
}

func validateThemeOverrides(index int, variant string, value any) error {
	overrides, ok := value.(map[string]any)
	if !ok {
		return fmt.Errorf("theme_profiles[%d].%s must be an object", index, variant)
	}
	for key, rawColor := range overrides {
		if _, valid := customThemeTokenKeys[key]; !valid {
			return fmt.Errorf("theme_profiles[%d].%s contains unknown token %q", index, variant, key)
		}
		color, ok := rawColor.(string)
		if !ok || !customThemeColorPattern.MatchString(color) {
			return fmt.Errorf("theme_profiles[%d].%s.%s is not a hex color", index, variant, key)
		}
	}
	return nil
}

func validThemeFontFamily(value string) bool {
	if value == "system" {
		return true
	}
	if value == "" || len([]byte(value)) > 120 {
		return false
	}
	for _, character := range value {
		if unicode.IsLetter(character) || unicode.IsNumber(character) || unicode.IsSpace(character) {
			continue
		}
		switch character {
		case ',', '\'', '"', '.', '-':
			continue
		default:
			return false
		}
	}
	return true
}
