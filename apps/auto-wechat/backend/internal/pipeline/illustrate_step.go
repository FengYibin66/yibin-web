package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
)

const minIllustrationWidth = 400

func (e *Engine) runIllustrate(
	ctx context.Context,
	runID string,
	items []domain.RankedItem,
	articles []domain.Article,
	editor domain.EditorOutput,
) (domain.IllustrationOutput, map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepIllustrate, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return domain.IllustrationOutput{}, nil, err
	}

	byURL := articlesByURL(articles)
	slots := make([]domain.IllustrationSlot, 0, len(items))
	for idx, item := range items {
		slot := e.buildIllustrationSlot(ctx, runID, idx+1, item, byURL[item.URL], editor)
		slots = append(slots, slot)
	}

	out := domain.IllustrationOutput{
		PlanVersion: domain.IllustrationPlanVersion,
		Slots:       slots,
		Stats:       computeIllustrationStats(slots),
	}

	stepOutput := toOutputMap(out)
	if err := e.finishStepSucceeded(ctx, runID, domain.StepIllustrate, start, stepOutput); err != nil {
		return domain.IllustrationOutput{}, nil, err
	}
	return out, stepOutput, nil
}

func articlesByURL(articles []domain.Article) map[string]domain.Article {
	byURL := make(map[string]domain.Article, len(articles))
	for _, article := range articles {
		byURL[article.URL] = article
	}
	return byURL
}

func (e *Engine) buildIllustrationSlot(
	ctx context.Context,
	runID string,
	rank int,
	item domain.RankedItem,
	article domain.Article,
	editor domain.EditorOutput,
) domain.IllustrationSlot {
	slotID := fmt.Sprintf("news_%d", rank)
	bindTo := domain.IllustrationBindTo{
		SourceURL: item.URL,
		Headline:  item.Title,
		Section:   editor.Topic,
		Rank:      rank,
	}
	slot := domain.IllustrationSlot{
		ID:     slotID,
		Role:   domain.IllustrationRoleNewsThumbnail,
		BindTo: bindTo,
		Status: domain.IllustrationStatusPending,
	}

	if article.ImageURL != "" {
		if imageMeta, ok := e.tryRSSImage(ctx, article.ImageURL); ok {
			slot.Image = domain.IllustrationImage{
				URL:       imageMeta.URL,
				Source:    string(domain.ImageSourceRSS),
				OriginURL: article.ImageURL,
				Width:     imageMeta.Width,
				Height:    imageMeta.Height,
			}
			slot.Status = domain.IllustrationStatusReady
			return slot
		}
	}

	generated, err := e.generateIllustrationImage(ctx, item, editor)
	if err != nil {
		msg := err.Error()
		slot.Status = domain.IllustrationStatusFailed
		slot.ErrorMessage = &msg
		return slot
	}

	if e.imageAssets == nil {
		slot.Image = domain.IllustrationImage{
			URL:       generated.OriginURL,
			Source:    string(domain.ImageSourceGenerated),
			OriginURL: generated.OriginURL,
			Prompt:    generated.Prompt,
			Width:     generated.Width,
			Height:    generated.Height,
		}
		slot.Status = domain.IllustrationStatusReady
		return slot
	}

	asset, _, ingestErr := e.imageAssets.Ingest(ctx, domain.IngestImageInput{
		Name:         truncateRunes(item.Title, 80),
		Source:       domain.ImageSourceGenerated,
		OriginURL:    generated.OriginURL,
		Prompt:       generated.Prompt,
		AutoIngested: true,
		Data:         generated.Data,
		MimeType:     generated.MimeType,
		Width:        generated.Width,
		Height:       generated.Height,
		Provenance: domain.ImageProvenance{
			FirstRunID:  runID,
			FirstSlotID: slotID,
			Headline:    item.Title,
		},
	})
	if ingestErr != nil {
		slot.Image = domain.IllustrationImage{
			URL:       generated.OriginURL,
			Source:    string(domain.ImageSourceGenerated),
			OriginURL: generated.OriginURL,
			Prompt:    generated.Prompt,
			Width:     generated.Width,
			Height:    generated.Height,
		}
		slot.Status = domain.IllustrationStatusReady
		return slot
	}

	assetID := asset.ID
	slot.Image = domain.IllustrationImage{
		AssetID:   &assetID,
		InLibrary: true,
		URL:       asset.URL,
		Source:    string(domain.ImageSourceGenerated),
		OriginURL: generated.OriginURL,
		Prompt:    generated.Prompt,
		Width:     asset.Width,
		Height:    asset.Height,
	}
	slot.Status = domain.IllustrationStatusReady
	return slot
}

type fetchedImageMeta struct {
	URL    string
	Width  int
	Height int
}

func (e *Engine) tryRSSImage(ctx context.Context, imageURL string) (fetchedImageMeta, bool) {
	data, _, err := e.coverFetcher.FetchFirst(ctx, imageURL)
	if err != nil || len(data) == 0 {
		return fetchedImageMeta{}, false
	}
	if len(data) > media.MaxImageBytes {
		return fetchedImageMeta{}, false
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width < minIllustrationWidth {
		return fetchedImageMeta{}, false
	}
	return fetchedImageMeta{URL: imageURL, Width: cfg.Width, Height: cfg.Height}, true
}

type generatedIllustration struct {
	OriginURL string
	Prompt    string
	Data      []byte
	MimeType  string
	Width     int
	Height    int
}

func (e *Engine) generateIllustrationImage(
	ctx context.Context,
	item domain.RankedItem,
	editor domain.EditorOutput,
) (generatedIllustration, error) {
	input := map[string]any{
		"headline":  item.Title,
		"summary":   firstNonEmptyStr(item.SummaryZH, item.Summary),
		"topic":     editor.Topic,
		"section":   editor.Topic,
		"sourceUrl": item.URL,
	}
	output, err := e.llmClient.Invoke(ctx, "illustrate", input)
	if err != nil {
		return generatedIllustration{}, err
	}

	imageURL := stringField(output, "imageUrl")
	if imageURL == "" {
		return generatedIllustration{}, fmt.Errorf("illustrate agent returned empty imageUrl")
	}

	data, mimeType, width, height, err := fetchAndFitIllustrationImage(ctx, e.coverFetcher, imageURL)
	if err != nil {
		return generatedIllustration{}, err
	}

	return generatedIllustration{
		OriginURL: imageURL,
		Prompt:    stringField(output, "imagePrompt"),
		Data:      data,
		MimeType:  mimeType,
		Width:     width,
		Height:    height,
	}, nil
}

func computeIllustrationStats(slots []domain.IllustrationSlot) domain.IllustrationStats {
	stats := domain.IllustrationStats{
		Total:    len(slots),
		BySource: map[string]int{},
	}
	for _, slot := range slots {
		switch slot.Status {
		case domain.IllustrationStatusReady:
			stats.Ready++
		case domain.IllustrationStatusFailed:
			stats.Failed++
		}
		if slot.Image.InLibrary {
			stats.InLibrary++
		}
		if slot.Image.Source != "" {
			stats.BySource[slot.Image.Source]++
		}
	}
	return stats
}

func illustrationURLsForValidate(out domain.IllustrationOutput) []string {
	urls := make([]string, 0, len(out.Slots))
	for _, slot := range out.Slots {
		if slot.Status != domain.IllustrationStatusReady || slot.Image.URL == "" {
			continue
		}
		urls = append(urls, slot.Image.URL)
	}
	return urls
}

func illustrationsForLayout(out domain.IllustrationOutput) map[string]any {
	bySourceURL := make(map[string]string)
	layoutSlots := make([]map[string]any, 0, len(out.Slots))
	for _, slot := range out.Slots {
		if slot.Status != domain.IllustrationStatusReady || slot.Image.URL == "" {
			continue
		}
		bySourceURL[slot.BindTo.SourceURL] = slot.Image.URL
		layoutSlots = append(layoutSlots, map[string]any{
			"id":     slot.ID,
			"bindTo": slot.BindTo,
			"image": map[string]any{
				"url":    slot.Image.URL,
				"source": slot.Image.Source,
			},
			"status": "ready",
		})
	}
	return map[string]any{
		"slots":       layoutSlots,
		"bySourceUrl": bySourceURL,
	}
}

func parseIllustrationOutput(raw map[string]any) (domain.IllustrationOutput, error) {
	data, err := json.Marshal(raw)
	if err != nil {
		return domain.IllustrationOutput{}, err
	}
	var out domain.IllustrationOutput
	if err := json.Unmarshal(data, &out); err != nil {
		return domain.IllustrationOutput{}, err
	}
	if out.PlanVersion == "" {
		out.PlanVersion = domain.IllustrationPlanVersion
	}
	if out.Stats.Total == 0 && len(out.Slots) > 0 {
		out.Stats = computeIllustrationStats(out.Slots)
	}
	return out, nil
}

func (e *Engine) ensureIllustrationOutput(
	ctx context.Context,
	runID string,
	items []domain.RankedItem,
	articles []domain.Article,
	editor domain.EditorOutput,
) (domain.IllustrationOutput, error) {
	out, err := e.loadIllustrationOutput(ctx, runID)
	if err == nil && len(out.Slots) > 0 {
		return out, nil
	}
	out, _, err = e.runIllustrate(ctx, runID, items, articles, editor)
	return out, err
}

func (e *Engine) loadIllustrationOutput(ctx context.Context, runID string) (domain.IllustrationOutput, error) {
	step, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepIllustrate)
	if err != nil {
		return domain.IllustrationOutput{}, err
	}
	if len(step.OutputJSON) == 0 {
		return domain.IllustrationOutput{}, fmt.Errorf("illustrate output empty")
	}
	var raw map[string]any
	if err := json.Unmarshal(step.OutputJSON, &raw); err != nil {
		return domain.IllustrationOutput{}, err
	}
	return parseIllustrationOutput(raw)
}
