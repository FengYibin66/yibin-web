package textutil

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func TestNormalizeArticle_truncatesSummaryWithoutBreakingUTF8(t *testing.T) {
	longSummary := strings.Repeat("中", 600)
	article := NormalizeArticle(domain.Article{
		Title:   "标题",
		Summary: longSummary,
	})
	if !utf8.ValidString(article.Summary) {
		t.Fatal("summary must be valid UTF-8")
	}
	if len([]rune(article.Summary)) != MaxArticleSummaryRunes {
		t.Fatalf("expected %d runes, got %d", MaxArticleSummaryRunes, len([]rune(article.Summary)))
	}
}
