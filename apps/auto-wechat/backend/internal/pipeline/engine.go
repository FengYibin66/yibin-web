package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/domain/rank"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/cover"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/llmclient"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/collect"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/wechat"
)

type Engine struct {
	pipelineRepo *mysql.PipelineRepository
	sourceRepo   *mysql.SourceRepository
	articleRepo  *mysql.ArticleRepository
	digestRepo   *mysql.DigestRepository
	draftRepo    *mysql.ContentDraftRepository
	collector    *collect.Registry
	llmClient    *llmclient.Client
	wechatClient *wechat.Client
	coverFetcher     *cover.Fetcher
	publicAPIBaseURL    string
	wechatReadSourceURL      string
	readSourcePresetRepo     *mysql.ReadSourcePresetRepository
	layoutTemplateRepo       *mysql.LayoutTemplateRepository
	imageAssets              *application.ImageAssetService
}

func NewEngine(
	pipelineRepo *mysql.PipelineRepository,
	sourceRepo *mysql.SourceRepository,
	articleRepo *mysql.ArticleRepository,
	digestRepo *mysql.DigestRepository,
	draftRepo *mysql.ContentDraftRepository,
	collector *collect.Registry,
	llmClient *llmclient.Client,
	wechatClient *wechat.Client,
	coverFetcher *cover.Fetcher,
	publicAPIBaseURL string,
	wechatReadSourceURL string,
	readSourcePresetRepo *mysql.ReadSourcePresetRepository,
	layoutTemplateRepo *mysql.LayoutTemplateRepository,
	imageAssets *application.ImageAssetService,
	llmInvokeTimeout time.Duration,
) *Engine {
	if llmInvokeTimeout <= 0 {
		llmInvokeTimeout = 10 * time.Minute
	}
	return &Engine{
		pipelineRepo: pipelineRepo,
		sourceRepo:   sourceRepo,
		articleRepo:  articleRepo,
		digestRepo:   digestRepo,
		draftRepo:    draftRepo,
		collector:    collector,
		llmClient:    llmClient.WithTimeout(llmInvokeTimeout),
		wechatClient: wechatClient,
		coverFetcher:     coverFetcher,
		publicAPIBaseURL:    publicAPIBaseURL,
		wechatReadSourceURL:  wechatReadSourceURL,
		readSourcePresetRepo: readSourcePresetRepo,
		layoutTemplateRepo: layoutTemplateRepo,
		imageAssets:        imageAssets,
	}
}

func (e *Engine) Run(ctx context.Context, runID string) error {
	log.Printf("pipeline engine run_id=%s phase=3", runID)

	return e.withActiveJob(ctx, runID, runJobID("execute", ""), func(ctx context.Context) error {
		return e.runFullPipeline(ctx, runID)
	})
}

func (e *Engine) runFullPipeline(ctx context.Context, runID string) error {
	if e.abortIfRunDeleted(ctx, runID) {
		return nil
	}
	if err := e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusRunning, nil); err != nil {
		if isRunNotFound(err) {
			return nil
		}
		return err
	}

	articles, collectOutput, err := e.runCollect(ctx, runID)
	if err != nil {
		return e.failRun(ctx, runID, err)
	}

	ranked, rankOutput, rankUsedFallback, err := e.runRank(ctx, runID, articles)
	if err != nil {
		return e.failRun(ctx, runID, err)
	}

	enriched, enrichOutput, err := e.runEnrich(ctx, runID, ranked, articles)
	if err != nil {
		return e.failRun(ctx, runID, err)
	}

	stats := map[string]any{
		"collect":      collectOutput,
		"rankFallback": rankUsedFallback,
		"rank":         rankOutput,
		"enrich":       enrichOutput,
		"topCount":     len(enriched),
	}

	digest, err := e.digestRepo.Create(ctx, runID, enriched, stats)
	if err != nil {
		return e.failRun(ctx, runID, err)
	}

	editorOut, writerOut, layoutOut, reviewOut, contentMeta, contentErr := e.runContentPipeline(ctx, runID, digest, articles)
	stats["content"] = contentMeta
	stats["reviewApproved"] = reviewOut.Approved

	if contentErr != nil {
		return e.failRun(ctx, runID, contentErr)
	}

	if layoutOut.BodyHTML != "" {
		if err := e.syncDraftFromSteps(ctx, runID); err != nil {
			return e.failRun(ctx, runID, err)
		}
		html := layoutOut.BodyHTML
		if err := e.pipelineRepo.UpdateRunArtifacts(ctx, runID, nil, &html); err != nil {
			return e.failRun(ctx, runID, err)
		}
	}

	coverOut, coverErr := e.runCover(ctx, runID, layoutOut, writerOut, editorOut, digest.Items, articles)
	stats["cover"] = toOutputMap(coverOut)
	if coverErr != nil {
		return e.failRun(ctx, runID, coverErr)
	}

	coverURL := coverOut.CoverImageURL
	layoutOut.CoverImageURL = coverURL

	var savedDraft domain.ContentDraft
	if layoutOut.BodyHTML != "" {
		draft, err := e.draftRepo.GetByRunID(ctx, runID)
		if err != nil {
			return e.failRun(ctx, runID, err)
		}
		if coverURL != "" {
			coverPtr := coverURL
			savedDraft, err = e.draftRepo.Update(ctx, draft.ID, domain.UpdateDraftInput{CoverURL: &coverPtr})
			if err != nil {
				return e.failRun(ctx, runID, err)
			}
		} else {
			savedDraft = draft
		}
	}

	publishMode, err := e.pipelineRepo.GetRunPublishMode(ctx, runID)
	if err != nil {
		return e.failRun(ctx, runID, err)
	}

	if _, err := e.runPublish(ctx, runID, publishMode, savedDraft, layoutOut, articles); err != nil {
		return e.failRun(ctx, runID, err)
	}

	return e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusSucceeded, nil)
}

func (e *Engine) runCollect(ctx context.Context, runID string) ([]domain.Article, map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepCollect, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return nil, nil, err
	}

	sources, err := e.sourceRepo.ListEnabled(ctx)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepCollect, start, err)
		return nil, nil, err
	}

	result := e.collector.Collect(ctx, sources)
	if len(result.Articles) < e.collector.MinArticles() {
		err := fmt.Errorf("collect produced %d articles (min %d)", len(result.Articles), e.collector.MinArticles())
		e.finishStepFailed(ctx, runID, domain.StepCollect, start, err)
		return nil, nil, err
	}

	saved, err := e.articleRepo.UpsertBatch(ctx, result.Articles)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepCollect, start, err)
		return nil, nil, err
	}

	output := map[string]any{
		"sourceTotal":       result.SourceTotal,
		"sourceSuccess":     result.SourceSuccess,
		"sourceFailed":      result.SourceFailed,
		"filteredByRecency": result.FilteredByRecency,
		"filteredByKeyword": result.FilteredByKeyword,
		"articleCount":      len(result.Articles),
		"savedCount":        saved,
	}

	if err := e.finishStepSucceeded(ctx, runID, domain.StepCollect, start, output); err != nil {
		return nil, nil, err
	}

	return result.Articles, output, nil
}

func (e *Engine) runRank(ctx context.Context, runID string, articles []domain.Article) ([]domain.RankedItem, map[string]any, bool, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepRank, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return nil, nil, false, err
	}

	ranked, usedFallback, rankMeta, err := e.rankArticles(ctx, articles)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepRank, start, err)
		return nil, nil, false, err
	}

	output := map[string]any{
		"usedFallback": usedFallback,
		"meta":         rankMeta,
		"topCount":     len(ranked),
		"items":        ranked,
	}

	if err := e.finishStepSucceeded(ctx, runID, domain.StepRank, start, output); err != nil {
		return nil, nil, false, err
	}

	return ranked, output, usedFallback, nil
}

func (e *Engine) runEnrich(ctx context.Context, runID string, ranked []domain.RankedItem, articles []domain.Article) ([]domain.RankedItem, map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepEnrich, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return nil, nil, err
	}

	enriched, enrichMeta := e.enrichItems(ctx, ranked, articles)
	output := map[string]any{
		"meta":     enrichMeta,
		"topCount": len(enriched),
		"items":    enriched,
	}

	if err := e.finishStepSucceeded(ctx, runID, domain.StepEnrich, start, output); err != nil {
		return nil, nil, err
	}

	return enriched, output, nil
}

func (e *Engine) fetchArticles(ctx context.Context) ([]domain.Article, error) {
	sources, err := e.sourceRepo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}

	result := e.collector.Collect(ctx, sources)
	if len(result.Articles) < e.collector.MinArticles() {
		return nil, fmt.Errorf("collect produced %d articles (min %d)", len(result.Articles), e.collector.MinArticles())
	}
	return result.Articles, nil
}

func (e *Engine) rankArticles(ctx context.Context, articles []domain.Article) ([]domain.RankedItem, bool, map[string]any, error) {
	candidates := rank.SelectTopArticles(articles, 120)
	input := map[string]any{
		"articles": articlesToMaps(candidates),
		"topN":     domain.DigestTopN,
	}

	output, err := e.llmClient.Invoke(ctx, "ranker", input)
	if err == nil {
		items, parseErr := parseRankedItems(output)
		if parseErr == nil && len(items) >= 5 {
			return items, false, map[string]any{
				"mode":            "llm",
				"candidateCount":  len(candidates),
				"inputArticleCount": len(articles),
			}, nil
		}
		err = parseErr
	}

	log.Printf("rank llm fallback: %v", err)
	fallback := rank.RuleBasedTopN(articles, domain.DigestTopN)
	return fallback, true, map[string]any{
		"mode":              "rule",
		"error":             fmt.Sprintf("%v", err),
		"candidateCount":    len(candidates),
		"inputArticleCount": len(articles),
	}, nil
}

func (e *Engine) enrichItems(ctx context.Context, ranked []domain.RankedItem, articles []domain.Article) ([]domain.RankedItem, map[string]any) {
	input := map[string]any{
		"items": ranked,
	}

	output, err := e.llmClient.Invoke(ctx, "enricher", input)
	if err == nil {
		items, parseErr := parseRankedItems(output)
		if parseErr == nil && len(items) > 0 {
			return mergeEnriched(ranked, items), map[string]any{"mode": "llm"}
		}
		err = parseErr
	}

	log.Printf("enrich llm fallback: %v", err)
	return applyArticleFallback(ranked, articles), map[string]any{"mode": "passthrough", "error": fmt.Sprintf("%v", err)}
}

func (e *Engine) failRun(ctx context.Context, runID string, err error) error {
	if err == nil {
		return nil
	}
	if !e.runExists(ctx, runID) {
		log.Printf("run_id=%s deleted, skip failRun: %v", runID, err)
		return nil
	}
	msg := err.Error()
	_ = e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusFailed, &msg)
	return err
}

func (e *Engine) finishStepSucceeded(ctx context.Context, runID string, step domain.PipelineStep, start time.Time, output map[string]any) error {
	duration := int(time.Since(start).Milliseconds())
	outputJSON, err := json.Marshal(output)
	if err != nil {
		return err
	}
	return e.pipelineRepo.FinishStep(ctx, runID, step, domain.StepStatusSucceeded, nil, outputJSON, &duration)
}

func (e *Engine) finishStepFailed(ctx context.Context, runID string, step domain.PipelineStep, start time.Time, stepErr error) {
	duration := int(time.Since(start).Milliseconds())
	msg := stepErr.Error()
	_ = e.pipelineRepo.FinishStep(ctx, runID, step, domain.StepStatusFailed, &msg, nil, &duration)
}

func articlesToMaps(articles []domain.Article) []map[string]any {
	result := make([]map[string]any, 0, len(articles))
	for _, article := range articles {
		item := map[string]any{
			"url":            article.URL,
			"title":          article.Title,
			"summary":        article.Summary,
			"sourceName":     article.SourceName,
			"sourceType":     article.SourceType,
			"sourceCategory": article.SourceCategory,
			"weight":         article.Weight,
		}
		if article.PublishedAt != nil {
			item["publishedAt"] = article.PublishedAt.Format(time.RFC3339)
		}
		if article.ImageURL != "" {
			item["imageUrl"] = article.ImageURL
		}
		result = append(result, item)
	}
	return result
}

func parseRankedItems(output map[string]any) ([]domain.RankedItem, error) {
	rawItems, ok := output["items"].([]any)
	if !ok {
		return nil, fmt.Errorf("missing items in llm output")
	}

	items := make([]domain.RankedItem, 0, len(rawItems))
	for _, raw := range rawItems {
		m, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		item := domain.RankedItem{
			URL:       stringField(m, "url"),
			Title:     stringField(m, "title"),
			Score:     floatField(m, "score"),
			Reason:    stringField(m, "reason"),
			Summary:   stringField(m, "summary"),
			SummaryZH: stringField(m, "summaryZh"),
			Source:    stringField(m, "source"),
		}
		if item.URL == "" || item.Title == "" {
			continue
		}
		items = append(items, item)
	}

	if len(items) == 0 {
		return nil, fmt.Errorf("empty ranked items")
	}

	return items, nil
}

func mergeEnriched(base []domain.RankedItem, enriched []domain.RankedItem) []domain.RankedItem {
	byURL := make(map[string]domain.RankedItem, len(enriched))
	for _, item := range enriched {
		byURL[item.URL] = item
	}

	result := make([]domain.RankedItem, 0, len(base))
	for _, item := range base {
		if patch, ok := byURL[item.URL]; ok {
			if patch.SummaryZH != "" {
				item.SummaryZH = patch.SummaryZH
			}
			if len(patch.Tags) > 0 {
				item.Tags = patch.Tags
			}
			if patch.Summary != "" {
				item.Summary = patch.Summary
			}
		}
		result = append(result, item)
	}
	return result
}

func applyArticleFallback(ranked []domain.RankedItem, articles []domain.Article) []domain.RankedItem {
	byURL := make(map[string]domain.Article, len(articles))
	for _, article := range articles {
		byURL[article.URL] = article
	}

	result := make([]domain.RankedItem, 0, len(ranked))
	for _, item := range ranked {
		if article, ok := byURL[item.URL]; ok && item.Summary == "" {
			item.Summary = article.Summary
		}
		result = append(result, item)
	}
	return result
}

func stringField(m map[string]any, key string) string {
	value, ok := m[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return fmt.Sprintf("%v", typed)
	}
}

func floatField(m map[string]any, key string) float64 {
	value, ok := m[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case json.Number:
		f, _ := typed.Float64()
		return f
	default:
		return 0
	}
}
