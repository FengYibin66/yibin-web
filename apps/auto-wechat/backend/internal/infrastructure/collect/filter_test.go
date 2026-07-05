package collect

import (
	"testing"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func TestFilterByKeywordsExemptsCompanySources(t *testing.T) {
	articles := []domain.Article{
		{
			Title:          "Quarterly business update",
			Summary:        "Revenue and partnerships",
			SourceCategory: "company",
		},
		{
			Title:          "Local sports roundup",
			Summary:        "Weekend games",
			SourceCategory: "media",
		},
	}

	filtered := filterByKeywords(articles)
	if len(filtered) != 1 {
		t.Fatalf("expected 1 article, got %d", len(filtered))
	}
	if filtered[0].SourceCategory != "company" {
		t.Fatalf("expected company article to remain")
	}
}

func TestFilterByKeywordsMatchesAITerms(t *testing.T) {
	articles := []domain.Article{
		{
			Title:          "New GPT model launches",
			Summary:        "OpenAI update",
			SourceCategory: "media",
		},
	}

	filtered := filterByKeywords(articles)
	if len(filtered) != 1 {
		t.Fatalf("expected AI article to pass keyword filter")
	}
}

func TestFilterByRecencyDropsOldArticles(t *testing.T) {
	now := time.Now().UTC()
	old := now.Add(-96 * time.Hour)

	articles := []domain.Article{
		{Title: "Fresh", PublishedAt: &now},
		{Title: "Old", PublishedAt: &old},
		{Title: "No date"},
	}

	filtered := filterByRecency(articles, 2)
	if len(filtered) != 2 {
		t.Fatalf("expected 2 articles after recency filter, got %d", len(filtered))
	}
}
