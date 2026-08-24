package settings

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"MrRSS/internal/database"
	"MrRSS/internal/handlers/core"
)

func setupHandlerWithDB(t *testing.T) *core.Handler {
	t.Helper()
	db, err := database.NewDB(":memory:")
	if err != nil {
		t.Fatalf("NewDB error: %v", err)
	}
	if err := db.Init(); err != nil {
		t.Fatalf("db Init error: %v", err)
	}
	return core.NewHandler(db, nil, nil, nil)
}

func TestHandleSettings_GET(t *testing.T) {
	h := setupHandlerWithDB(t)

	// Set a custom value
	h.DB.SetSetting("language", "xx-YY")

	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	w := httptest.NewRecorder()

	HandleSettings(h, w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	var data map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if data["language"] != "xx-YY" {
		t.Fatalf("expected language xx-YY, got %s", data["language"])
	}
}

func TestHandleSettings_POST(t *testing.T) {
	h := setupHandlerWithDB(t)

	payload := map[string]string{
		"update_interval":     "15",
		"translation_enabled": "true",
		"deepl_api_key":       "deadbeef",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleSettings(h, w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	// Verify settings saved
	v, _ := h.DB.GetSetting("update_interval")
	if v != "15" {
		t.Fatalf("expected update_interval 15, got %s", v)
	}

	v2, _ := h.DB.GetSetting("translation_enabled")
	if v2 != "true" {
		t.Fatalf("expected translation_enabled true, got %s", v2)
	}

	// Encrypted key should be retrievable via GetEncryptedSetting
	dec, err := h.DB.GetEncryptedSetting("deepl_api_key")
	if err != nil {
		t.Fatalf("GetEncryptedSetting error: %v", err)
	}
	if dec != "deadbeef" {
		t.Fatalf("expected deepl_api_key decrypted to be deadbeef, got %s", dec)
	}
}

func TestHandleSettingsReaderCanvasRoundTripAndClear(t *testing.T) {
	h := setupHandlerWithDB(t)
	post := func(payload map[string]string) *httptest.ResponseRecorder {
		body, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		HandleSettings(h, recorder, req)
		return recorder
	}

	if response := post(map[string]string{
		"content_background_color": "#F7F1E3",
		"content_text_color":       "#352C24",
	}); response.Code != http.StatusOK {
		t.Fatalf("custom status = %d: %s", response.Code, response.Body.String())
	}
	if got, err := h.DB.GetSetting("content_background_color"); err != nil || got != "#f7f1e3" {
		t.Fatalf("background = %q, %v", got, err)
	}

	if response := post(map[string]string{
		"content_background_color": "",
		"content_text_color":       "",
	}); response.Code != http.StatusOK {
		t.Fatalf("clear status = %d: %s", response.Code, response.Body.String())
	}
	if got, err := h.DB.GetSetting("content_text_color"); err != nil || got != "" {
		t.Fatalf("text after clear = %q, %v", got, err)
	}
}

func TestHandleSettingsRejectsInvalidReaderCanvas(t *testing.T) {
	for name, payload := range map[string]map[string]string{
		"partial": {
			"content_background_color": "#ffffff",
		},
		"alpha": {
			"content_background_color": "#ffffff00",
			"content_text_color":       "#000000",
		},
		"named": {
			"content_background_color": "white",
			"content_text_color":       "#000000",
		},
		"low contrast": {
			"content_background_color": "#ffffff",
			"content_text_color":       "#eeeeee",
		},
	} {
		t.Run(name, func(t *testing.T) {
			h := setupHandlerWithDB(t)
			body, err := json.Marshal(payload)
			if err != nil {
				t.Fatal(err)
			}
			recorder := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(body))
			HandleSettings(h, recorder, req)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d: %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestHandleSettingsThemeProfilesRoundTrip(t *testing.T) {
	h := setupHandlerWithDB(t)
	profileJSON := `[{"id":"custom-1","name":"Focus","basePreset":"ink","appearance":"dark","light":{},"dark":{},"uiFontFamily":"system","uiFontSize":16,"updatedAt":"2026-08-23T00:00:00.000Z"}]`
	payload, err := json.Marshal(map[string]string{"theme_profiles": profileJSON})
	if err != nil {
		t.Fatal(err)
	}

	post := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(payload))
	post.Header.Set("Content-Type", "application/json")
	postResponse := httptest.NewRecorder()
	HandleSettings(h, postResponse, post)
	if postResponse.Code != http.StatusOK {
		t.Fatalf("POST status = %d", postResponse.Code)
	}

	getResponse := httptest.NewRecorder()
	HandleSettings(h, getResponse, httptest.NewRequest(http.MethodGet, "/api/settings", nil))
	var got map[string]string
	if err := json.NewDecoder(getResponse.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["theme_profiles"] != profileJSON {
		t.Fatalf("theme_profiles = %q, want %q", got["theme_profiles"], profileJSON)
	}

	emptyPayload, err := json.Marshal(map[string]string{"theme_profiles": "[]"})
	if err != nil {
		t.Fatal(err)
	}
	emptyPost := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(emptyPayload))
	emptyPost.Header.Set("Content-Type", "application/json")
	emptyResponse := httptest.NewRecorder()
	HandleSettings(h, emptyResponse, emptyPost)
	if emptyResponse.Code != http.StatusOK {
		t.Fatalf("empty POST status = %d", emptyResponse.Code)
	}
	if value, _ := h.DB.GetSetting("theme_profiles"); value != "[]" {
		t.Fatalf("theme_profiles after clearing = %q, want []", value)
	}
}

func TestHandleSettingsRejectsInvalidThemeProfiles(t *testing.T) {
	tests := []struct {
		name     string
		profiles string
	}{
		{
			name:     "malformed json",
			profiles: "[{",
		},
		{
			name:     "unknown token",
			profiles: `[{"id":"custom-1","light":{"--arbitrary":"#ffffff"}}]`,
		},
		{
			name:     "invalid color",
			profiles: `[{"id":"custom-1","light":{"accent-color":"red"}}]`,
		},
		{
			name:     "unsafe font",
			profiles: `[{"id":"custom-1","uiFontFamily":"system; color:red"}]`,
		},
		{
			name:     "font size outside range",
			profiles: `[{"id":"custom-1","uiFontSize":40}]`,
		},
		{
			name:     "missing profile fields",
			profiles: `[{"id":"custom-1","name":"Focus"}]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := setupHandlerWithDB(t)
			if err := h.DB.SetSetting("theme_profiles", "[]"); err != nil {
				t.Fatalf("seed theme_profiles: %v", err)
			}
			payload, err := json.Marshal(map[string]string{"theme_profiles": tt.profiles})
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			HandleSettings(h, w, req)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
			}
			stored, err := h.DB.GetSetting("theme_profiles")
			if err != nil {
				t.Fatalf("read theme_profiles: %v", err)
			}
			if stored != "[]" {
				t.Fatalf("theme_profiles changed to %q after rejected request", stored)
			}
		})
	}
}

func TestHandleSettingsRejectsOversizedThemeProfiles(t *testing.T) {
	h := setupHandlerWithDB(t)
	profiles := `[{"id":"custom-1","name":"` + strings.Repeat("x", 512*1024) + `"}]`
	payload, err := json.Marshal(map[string]string{"theme_profiles": profiles})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleSettings(h, w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleSettings_POSTDisablingFreshRSSCleansSyncedData(t *testing.T) {
	h := setupHandlerWithDB(t)

	if err := h.DB.SetSetting("freshrss_enabled", "true"); err != nil {
		t.Fatalf("SetSetting freshrss_enabled: %v", err)
	}

	res, err := h.DB.Exec(`
		INSERT INTO feeds (title, url, is_freshrss_source, freshrss_stream_id)
		VALUES (?, ?, 1, ?)
	`, "FreshRSS Feed", "https://example.com/freshrss.xml", "feed/1")
	if err != nil {
		t.Fatalf("insert FreshRSS feed: %v", err)
	}
	feedID, _ := res.LastInsertId()

	res, err = h.DB.Exec(`
		INSERT INTO articles (feed_id, title, url, published_at, unique_id)
		VALUES (?, ?, ?, datetime('now'), ?)
	`, feedID, "FreshRSS Article", "https://example.com/article", "fresh-article")
	if err != nil {
		t.Fatalf("insert FreshRSS article: %v", err)
	}
	articleID, _ := res.LastInsertId()

	if err := h.DB.SetArticleContent(articleID, "<p>cached</p>"); err != nil {
		t.Fatalf("SetArticleContent: %v", err)
	}
	if err := h.DB.EnqueueSyncChange(articleID, "https://example.com/article", database.SyncActionMarkRead); err != nil {
		t.Fatalf("EnqueueSyncChange: %v", err)
	}

	payload := map[string]string{"freshrss_enabled": "false"}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleSettings(h, w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", resp.StatusCode, w.Body.String())
	}

	assertCount := func(query string, want int, args ...any) {
		t.Helper()
		var got int
		if err := h.DB.QueryRow(query, args...).Scan(&got); err != nil {
			t.Fatalf("count query failed %q: %v", query, err)
		}
		if got != want {
			t.Fatalf("query %q got %d, want %d", query, got, want)
		}
	}

	assertCount("SELECT COUNT(*) FROM feeds WHERE is_freshrss_source = 1", 0)
	assertCount("SELECT COUNT(*) FROM articles WHERE feed_id = ?", 0, feedID)
	assertCount("SELECT COUNT(*) FROM article_contents WHERE article_id = ?", 0, articleID)
	assertCount("SELECT COUNT(*) FROM freshrss_sync_queue", 0)

	enabled, err := h.DB.GetSetting("freshrss_enabled")
	if err != nil {
		t.Fatalf("GetSetting freshrss_enabled: %v", err)
	}
	if enabled != "false" {
		t.Fatalf("expected freshrss_enabled false, got %q", enabled)
	}
}
