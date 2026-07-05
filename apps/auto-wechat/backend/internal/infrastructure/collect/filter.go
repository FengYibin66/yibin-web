package collect

import (
	"strings"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func filterByRecency(articles []domain.Article, days int) []domain.Article {
	if days <= 0 {
		return articles
	}

	cutoff := time.Now().UTC().Add(-time.Duration(days) * 24 * time.Hour)
	filtered := make([]domain.Article, 0, len(articles))
	for _, article := range articles {
		if article.PublishedAt == nil {
			filtered = append(filtered, article)
			continue
		}
		if !article.PublishedAt.Before(cutoff) {
			filtered = append(filtered, article)
		}
	}
	return filtered
}

func filterByKeywords(articles []domain.Article) []domain.Article {
	filtered := make([]domain.Article, 0, len(articles))
	for _, article := range articles {
		if matchesAIKeywords(article) {
			filtered = append(filtered, article)
		}
	}
	return filtered
}

func matchesAIKeywords(article domain.Article) bool {
	if _, ok := KeywordExemptCategories[article.SourceCategory]; ok {
		return true
	}

	text := strings.ToLower(article.Title + " " + article.Summary)
	for _, keyword := range AIKeywords {
		if strings.Contains(text, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}
