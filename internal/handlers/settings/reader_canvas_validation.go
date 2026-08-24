package settings

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

const minimumReaderCanvasContrast = 4.5

var readerCanvasColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type readerCanvasColor struct {
	red   float64
	green float64
	blue  float64
}

func normalizeReaderCanvasSettingsRequest(settings map[string]string) error {
	background, hasBackground := settings["content_background_color"]
	text, hasText := settings["content_text_color"]
	if !hasBackground && !hasText {
		return nil
	}
	if !hasBackground || !hasText {
		return fmt.Errorf("reader canvas colors must be provided together")
	}

	background = strings.ToLower(strings.TrimSpace(background))
	text = strings.ToLower(strings.TrimSpace(text))
	if background == "" && text == "" {
		settings["content_background_color"] = ""
		settings["content_text_color"] = ""
		return nil
	}
	if !readerCanvasColorPattern.MatchString(background) || !readerCanvasColorPattern.MatchString(text) {
		return fmt.Errorf("reader canvas colors must be six-digit hex colors")
	}
	if readerCanvasContrastRatio(background, text) < minimumReaderCanvasContrast {
		return fmt.Errorf("reader canvas colors must meet %.1f:1 contrast", minimumReaderCanvasContrast)
	}

	settings["content_background_color"] = background
	settings["content_text_color"] = text
	return nil
}

func readerCanvasContrastRatio(background, text string) float64 {
	backgroundColor, backgroundOK := parseReaderCanvasColor(background)
	textColor, textOK := parseReaderCanvasColor(text)
	if !backgroundOK || !textOK {
		return 0
	}

	backgroundLuminance := readerCanvasRelativeLuminance(backgroundColor)
	textLuminance := readerCanvasRelativeLuminance(textColor)
	lighter := math.Max(backgroundLuminance, textLuminance)
	darker := math.Min(backgroundLuminance, textLuminance)

	return (lighter + 0.05) / (darker + 0.05)
}

func parseReaderCanvasColor(value string) (readerCanvasColor, bool) {
	if !readerCanvasColorPattern.MatchString(value) {
		return readerCanvasColor{}, false
	}

	channels := [3]float64{}
	for index, offset := range []int{1, 3, 5} {
		parsed, err := strconv.ParseUint(value[offset:offset+2], 16, 8)
		if err != nil {
			return readerCanvasColor{}, false
		}
		channels[index] = float64(parsed) / 255
	}

	return readerCanvasColor{
		red:   channels[0],
		green: channels[1],
		blue:  channels[2],
	}, true
}

func readerCanvasRelativeLuminance(color readerCanvasColor) float64 {
	linearize := func(channel float64) float64 {
		if channel <= 0.04045 {
			return channel / 12.92
		}
		return math.Pow((channel+0.055)/1.055, 2.4)
	}

	return 0.2126*linearize(color.red) +
		0.7152*linearize(color.green) +
		0.0722*linearize(color.blue)
}
