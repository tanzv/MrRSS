package database_test

import (
	"testing"

	"MrRSS/internal/database"
	"MrRSS/internal/models"
)

func TestFeedAutoReadingModeDefaultsAndRoundTrips(t *testing.T) {
	db := setupTestDB(t)

	feedID, err := db.AddFeed(&models.Feed{
		Title: "Reader feed",
		URL:   "https://example.com/reader.xml",
	})
	if err != nil {
		t.Fatalf("AddFeed() error = %v", err)
	}

	feed, err := db.GetFeedByID(feedID)
	if err != nil {
		t.Fatalf("GetFeedByID() error = %v", err)
	}
	if feed.AutoReadingMode {
		t.Fatal("new feed unexpectedly enables automatic reading")
	}

	enabled := true
	if err := db.UpdateFeedWithOptions(feedID, database.FeedUpdateOptions{
		AutoReadingMode: &enabled,
	}); err != nil {
		t.Fatalf("UpdateFeedWithOptions() error = %v", err)
	}

	updatedFeed, err := db.GetFeedByID(feedID)
	if err != nil {
		t.Fatalf("GetFeedByID() after update error = %v", err)
	}
	if !updatedFeed.AutoReadingMode {
		t.Fatal("GetFeedByID() did not preserve automatic reading")
	}

	feeds, err := db.GetFeeds()
	if err != nil {
		t.Fatalf("GetFeeds() error = %v", err)
	}
	if len(feeds) != 1 || !feeds[0].AutoReadingMode {
		t.Fatalf("GetFeeds() = %#v, want one feed with automatic reading enabled", feeds)
	}
}
