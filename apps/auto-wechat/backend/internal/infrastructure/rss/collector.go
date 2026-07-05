package rss

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/textutil"
)

type Collector struct {
	parser *gofeed.Parser
	client *http.Client
	days   int
}

func NewCollector(days int) *Collector {
	parser := gofeed.NewParser()
	parser.Client = &http.Client{Timeout: 20 * time.Second}
	if days <= 0 {
		days = 2
	}
	return &Collector{
		parser: parser,
		client: parser.Client,
		days:   days,
	}
}

func (c *Collector) Collect(ctx context.Context, sources []domain.Source) domain.CollectResult {
	result := domain.CollectResult{
		SourceTotal: len(sources),
		Articles:    make([]domain.Article, 0),
	}

	seen := make(map[string]struct{})

	for _, source := range sources {
		articles, err := c.FetchSource(ctx, source)
		if err != nil {
			log.Printf("rss collect failed source=%s err=%v", source.Name, err)
			result.SourceFailed = append(result.SourceFailed, source.Name)
			continue
		}

		result.SourceSuccess++
		for _, article := range articles {
			if _, ok := seen[article.URL]; ok {
				continue
			}
			seen[article.URL] = struct{}{}
			result.Articles = append(result.Articles, article)
		}
	}

	return result
}

func (c *Collector) FetchSource(ctx context.Context, source domain.Source) ([]domain.Article, error) {
	feed, err := c.parser.ParseURLWithContext(source.URL, ctx)
	if err != nil {
		return nil, fmt.Errorf("parse feed: %w", err)
	}

	cutoff := time.Now().UTC().Add(-time.Duration(c.days) * 24 * time.Hour)
	articles := make([]domain.Article, 0, len(feed.Items))
	for _, item := range feed.Items {
		article := normalizeItem(source, item)
		if article.URL == "" || article.Title == "" {
			continue
		}
		if article.PublishedAt != nil && article.PublishedAt.Before(cutoff) {
			continue
		}
		articles = append(articles, article)
	}

	return articles, nil
}

func normalizeItem(source domain.Source, item *gofeed.Item) domain.Article {
	title := strings.TrimSpace(item.Title)
	url := firstNonEmpty(item.Link, item.GUID)
	summary := textutil.TruncateRunes(
		strings.TrimSpace(firstNonEmpty(item.Description, item.Content)),
		textutil.MaxArticleSummaryRunes,
	)
	title = textutil.TruncateRunes(title, textutil.MaxArticleTitleRunes)

	var publishedAt *time.Time
	if item.PublishedParsed != nil {
		t := item.PublishedParsed.UTC()
		publishedAt = &t
	} else if item.UpdatedParsed != nil {
		t := item.UpdatedParsed.UTC()
		publishedAt = &t
	}

	imageURL := ""
	if item.Image != nil {
		imageURL = item.Image.URL
	}

	lang := source.Lang
	if lang == "" {
		lang = "en"
	}

	sourceType := source.Type
	if sourceType == "" {
		sourceType = "rss"
	}

	category := source.Category
	if category == "" {
		category = "media"
	}

	return domain.Article{
		SourceID:       source.ID,
		Title:          title,
		URL:            url,
		SourceName:     source.Name,
		SourceType:     sourceType,
		SourceCategory: category,
		PublishedAt:    publishedAt,
		Summary:        summary,
		Language:       lang,
		Weight:         source.Weight,
		ImageURL:       imageURL,
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
