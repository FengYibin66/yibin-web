package collect

import (
	"context"
	"log"
	"sync"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/rss"
)

type Registry struct {
	rss  *rss.Collector
	opts Options
}

func NewRegistry(opts Options) *Registry {
	normalized := opts.withDefaults()
	return &Registry{
		rss:  rss.NewCollector(normalized.Days),
		opts: normalized,
	}
}

func (r *Registry) MinArticles() int {
	return r.opts.MinArticles
}

func (r *Registry) Collect(ctx context.Context, sources []domain.Source) domain.CollectResult {
	result := domain.CollectResult{
		SourceTotal: len(sources),
		Articles:    make([]domain.Article, 0),
	}

	if len(sources) == 0 {
		return result
	}

	type sourceResult struct {
		name     string
		articles []domain.Article
		err      error
	}

	ch := make(chan sourceResult, len(sources))
	var wg sync.WaitGroup

	for _, source := range sources {
		wg.Add(1)
		go func(source domain.Source) {
			defer wg.Done()
			articles, err := r.rss.FetchSource(ctx, source)
			ch <- sourceResult{name: source.Name, articles: articles, err: err}
		}(source)
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	seen := make(map[string]struct{})

	for item := range ch {
		if item.err != nil {
			log.Printf("collect failed source=%s err=%v", item.name, item.err)
			result.SourceFailed = append(result.SourceFailed, item.name)
			continue
		}

		result.SourceSuccess++
		for _, article := range item.articles {
			if _, ok := seen[article.URL]; ok {
				continue
			}
			seen[article.URL] = struct{}{}
			result.Articles = append(result.Articles, article)
		}
	}

	beforeFilter := len(result.Articles)
	result.Articles = filterByRecency(result.Articles, r.opts.Days)
	result.FilteredByRecency = beforeFilter - len(result.Articles)

	if r.opts.KeywordFilter {
		beforeKeyword := len(result.Articles)
		result.Articles = filterByKeywords(result.Articles)
		result.FilteredByKeyword = beforeKeyword - len(result.Articles)
	}

	return result
}
