package rank_test

import (
	"testing"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/domain/rank"
)

func TestRuleBasedTopNOrdersByWeightAndRecency(t *testing.T) {
	now := time.Now().UTC()
	old := now.Add(-96 * time.Hour)

	articles := []domain.Article{
		{URL: "https://a.test/1", Title: "Old high weight", Weight: 2, PublishedAt: &old, SourceName: "A"},
		{URL: "https://a.test/2", Title: "Fresh low weight", Weight: 1, PublishedAt: &now, SourceName: "B"},
		{URL: "https://a.test/3", Title: "Fresh high weight", Weight: 2, PublishedAt: &now, SourceName: "C"},
	}

	items := rank.RuleBasedTopN(articles, 2)
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if items[0].URL != "https://a.test/3" {
		t.Fatalf("expected freshest high-weight first, got %s", items[0].URL)
	}
}

func TestRuleBasedTopNReturnsAtLeastFiveWhenEnoughArticles(t *testing.T) {
	now := time.Now().UTC()
	articles := make([]domain.Article, 0, 8)
	for i := 0; i < 8; i++ {
		articles = append(articles, domain.Article{
			URL:         "https://a.test/" + string(rune('a'+i)),
			Title:       "Article",
			Weight:      1,
			PublishedAt: &now,
		})
	}

	items := rank.RuleBasedTopN(articles, 10)
	if len(items) < 5 {
		t.Fatalf("expected at least 5 items, got %d", len(items))
	}
}

func TestPreScorePrefersCompanyCategory(t *testing.T) {
	now := time.Now().UTC()
	company := domain.Article{
		Weight:         1,
		PublishedAt:    &now,
		SourceCategory: "company",
	}
	media := domain.Article{
		Weight:         1,
		PublishedAt:    &now,
		SourceCategory: "media",
	}

	if rank.PreScore(company, now) <= rank.PreScore(media, now) {
		t.Fatalf("expected company article to score higher than media")
	}
}

func TestSelectTopArticlesLimitsCount(t *testing.T) {
	now := time.Now().UTC()
	articles := make([]domain.Article, 0, 5)
	for i := 0; i < 5; i++ {
		articles = append(articles, domain.Article{
			URL:         "https://a.test/" + string(rune('a'+i)),
			Weight:      float64(i + 1),
			PublishedAt: &now,
		})
	}

	selected := rank.SelectTopArticles(articles, 3)
	if len(selected) != 3 {
		t.Fatalf("expected 3 articles, got %d", len(selected))
	}
	if selected[0].Weight < selected[1].Weight {
		t.Fatalf("expected articles sorted by pre-score")
	}
}
