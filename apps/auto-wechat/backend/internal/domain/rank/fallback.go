package rank

import (
	"math"
	"sort"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func RuleBasedTopN(articles []domain.Article, topN int) []domain.RankedItem {
	if topN <= 0 {
		topN = domain.DigestTopN
	}

	scored := make([]domain.RankedItem, 0, len(articles))
	now := time.Now().UTC()

	for _, article := range articles {
		score := PreScore(article, now)
		scored = append(scored, domain.RankedItem{
			URL:     article.URL,
			Title:   article.Title,
			Score:   score,
			Reason:  "rule: weight × recency + category",
			Source:  article.SourceName,
			Summary: article.Summary,
		})
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	if len(scored) > topN {
		scored = scored[:topN]
	}

	return scored
}

func SelectTopArticles(articles []domain.Article, limit int) []domain.Article {
	if limit <= 0 || len(articles) <= limit {
		return articles
	}

	now := time.Now().UTC()
	sorted := make([]domain.Article, len(articles))
	copy(sorted, articles)

	sort.Slice(sorted, func(i, j int) bool {
		return PreScore(sorted[i], now) > PreScore(sorted[j], now)
	})

	return sorted[:limit]
}

func PreScore(article domain.Article, now time.Time) float64 {
	weight := article.Weight
	if weight <= 0 {
		weight = 1
	}

	recency := 0.5
	if article.PublishedAt != nil {
		hours := now.Sub(article.PublishedAt.UTC()).Hours()
		if hours < 0 {
			hours = 0
		}
		recency = math.Exp(-hours / 72)
	}

	return weight*recency + categoryBonus(article.SourceCategory)
}

func categoryBonus(category string) float64 {
	switch category {
	case "company":
		return 0.15
	case "papers":
		return 0.12
	case "cn_media":
		return 0.1
	case "media":
		return 0.05
	default:
		return 0
	}
}
