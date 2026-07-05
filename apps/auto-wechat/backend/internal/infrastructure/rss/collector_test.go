package rss_test

import (
	"testing"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/rss"
)

func TestCollectReturnsResultForSources(t *testing.T) {
	collector := rss.NewCollector(2)

	sources := []domain.Source{
		{ID: "s1", Name: "S1", Type: "rss", Category: "media", URL: "http://example.com/feed1.xml", Weight: 1, Lang: "en", Enabled: true},
	}

	result := collector.Collect(t.Context(), sources)
	if result.SourceTotal != 1 {
		t.Fatalf("expected 1 source total")
	}
}
