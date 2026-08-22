package feed_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	fh "MrRSS/internal/handlers/feed"
	"MrRSS/internal/models"
)

func TestHandleFeeds_ReturnsList(t *testing.T) {
	h := setupHandler(t)

	// add two feeds
	if _, err := h.DB.AddFeed(&models.Feed{Title: "a", URL: "http://x/1"}); err != nil {
		t.Fatalf("add feed: %v", err)
	}
	if _, err := h.DB.AddFeed(&models.Feed{Title: "b", URL: "http://x/2"}); err != nil {
		t.Fatalf("add feed: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/feeds", nil)
	w := httptest.NewRecorder()

	fh.HandleFeeds(h, w, req)
	res := w.Result()
	if res.StatusCode != 200 {
		t.Fatalf("expected 200 OK, got %d", res.StatusCode)
	}

	var feeds []models.Feed
	if err := json.NewDecoder(res.Body).Decode(&feeds); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(feeds) < 2 {
		t.Fatalf("expected at least 2 feeds, got %d", len(feeds))
	}
}

func TestHandleFeeds_ReturnsAutoReadingMode(t *testing.T) {
	h := setupHandler(t)

	if _, err := h.DB.AddFeed(&models.Feed{
		Title:           "Reader",
		URL:             "https://example.com/reader.xml",
		AutoReadingMode: true,
	}); err != nil {
		t.Fatalf("AddFeed() error = %v", err)
	}

	req := httptest.NewRequest("GET", "/api/feeds", nil)
	w := httptest.NewRecorder()
	fh.HandleFeeds(h, w, req)

	if w.Result().StatusCode != 200 {
		t.Fatalf("HandleFeeds() status = %d, want 200", w.Result().StatusCode)
	}

	var feeds []models.Feed
	if err := json.NewDecoder(w.Result().Body).Decode(&feeds); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(feeds) != 1 || !feeds[0].AutoReadingMode {
		t.Fatalf("HandleFeeds() = %#v, want one feed with automatic reading enabled", feeds)
	}
}
