package textutil

import (
	"strings"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

// NormalizeArticle ensures text fields are valid UTF-8 and within storage limits
// before persistence. Call at the repository boundary so every ingest path is covered.
func NormalizeArticle(article domain.Article) domain.Article {
	article.Title = TruncateRunes(article.Title, MaxArticleTitleRunes)
	article.Summary = TruncateRunes(article.Summary, MaxArticleSummaryRunes)
	article.Content = strings.ToValidUTF8(article.Content, "")
	article.SourceName = TruncateRunes(article.SourceName, 255)
	return article
}
