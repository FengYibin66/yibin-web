package application

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/cover"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/llmclient"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

const minIllustrationWidth = 400

type IllustrationRegenerator struct {
	pipelineRepo *mysql.PipelineRepository
	llmClient    *llmclient.Client
	coverFetcher *cover.Fetcher
	imageAssets  *ImageAssetService
}

func NewIllustrationRegenerator(
	pipelineRepo *mysql.PipelineRepository,
	llmClient *llmclient.Client,
	coverFetcher *cover.Fetcher,
	imageAssets *ImageAssetService,
) *IllustrationRegenerator {
	return &IllustrationRegenerator{
		pipelineRepo: pipelineRepo,
		llmClient:    llmClient,
		coverFetcher: coverFetcher,
		imageAssets:  imageAssets,
	}
}

func (r *IllustrationRegenerator) RegenerateIllustrationSlot(
	ctx context.Context,
	runID, slotID, mode string,
) (domain.IllustrationOutput, error) {
	svc := &IllustrationService{
		pipelineRepo: r.pipelineRepo,
		imageAssets:  r.imageAssets,
		coverFetcher: r.coverFetcher,
	}
	out, err := svc.GetOutput(ctx, runID)
	if err != nil {
		return domain.IllustrationOutput{}, err
	}

	idx := findSlotIndex(out.Slots, slotID)
	if idx < 0 {
		return domain.IllustrationOutput{}, fmt.Errorf("slot not found: %s", slotID)
	}

	editorOut, err := loadEditorFromStep(ctx, r.pipelineRepo, runID)
	if err != nil {
		return domain.IllustrationOutput{}, err
	}

	slot := out.Slots[idx]
	item := domain.RankedItem{URL: slot.BindTo.SourceURL, Title: slot.BindTo.Headline}

	if mode != "ai" {
		rssURL := slot.Image.OriginURL
		if rssURL == "" {
			rssURL = slot.Image.URL
		}
		if meta, ok := tryRSSImage(ctx, r.coverFetcher, rssURL); ok {
			slot.Image = domain.IllustrationImage{
				URL:       meta.URL,
				Source:    string(domain.ImageSourceRSS),
				OriginURL: rssURL,
				Width:     meta.Width,
				Height:    meta.Height,
			}
			slot.Status = domain.IllustrationStatusReady
			slot.ErrorMessage = nil
			out.Slots[idx] = slot
			out.Stats = computeIllustrationStats(out.Slots)
			return out, svc.saveOutput(ctx, runID, out)
		}
	}

	newSlot, buildErr := r.buildGeneratedSlot(ctx, runID, slot, item, editorOut)
	if buildErr != nil {
		msg := buildErr.Error()
		slot.Status = domain.IllustrationStatusFailed
		slot.ErrorMessage = &msg
		out.Slots[idx] = slot
	} else {
		out.Slots[idx] = newSlot
	}
	out.Stats = computeIllustrationStats(out.Slots)
	return out, svc.saveOutput(ctx, runID, out)
}

func (r *IllustrationRegenerator) buildGeneratedSlot(
	ctx context.Context,
	runID string,
	base domain.IllustrationSlot,
	item domain.RankedItem,
	editor domain.EditorOutput,
) (domain.IllustrationSlot, error) {
	summary := item.Summary
	if item.SummaryZH != "" {
		summary = item.SummaryZH
	}
	input := map[string]any{
		"headline":  item.Title,
		"summary":   summary,
		"topic":     editor.Topic,
		"section":   editor.Topic,
		"sourceUrl": item.URL,
	}
	output, err := r.llmClient.Invoke(ctx, "illustrate", input)
	if err != nil {
		return domain.IllustrationSlot{}, err
	}
	imageURL, _ := output["imageUrl"].(string)
	if imageURL == "" {
		return domain.IllustrationSlot{}, fmt.Errorf("illustrate agent returned empty imageUrl")
	}

	raw, filename, err := r.coverFetcher.FetchFirst(ctx, imageURL)
	if err != nil {
		return domain.IllustrationSlot{}, err
	}
	data, mimeType, width, height, err := media.PrepareIllustrationImage(raw, filename)
	if err != nil {
		return domain.IllustrationSlot{}, err
	}

	prompt, _ := output["imagePrompt"].(string)
	asset, _, err := r.imageAssets.Ingest(ctx, domain.IngestImageInput{
		Name:         item.Title,
		Source:       domain.ImageSourceGenerated,
		OriginURL:    imageURL,
		Prompt:       prompt,
		AutoIngested: true,
		Data:         data,
		MimeType:     mimeType,
		Provenance: domain.ImageProvenance{
			FirstRunID:  runID,
			FirstSlotID: base.ID,
			Headline:    item.Title,
		},
	})
	if err != nil {
		slot := base
		slot.Image = domain.IllustrationImage{
			URL:       imageURL,
			Source:    string(domain.ImageSourceGenerated),
			OriginURL: imageURL,
			Prompt:    prompt,
			Width:     width,
			Height:    height,
		}
		slot.Status = domain.IllustrationStatusReady
		slot.ErrorMessage = nil
		return slot, nil
	}

	assetID := asset.ID
	slot := base
	slot.Image = domain.IllustrationImage{
		AssetID:   &assetID,
		InLibrary: true,
		URL:       asset.URL,
		Source:    string(domain.ImageSourceGenerated),
		OriginURL: imageURL,
		Prompt:    prompt,
		Width:     asset.Width,
		Height:    asset.Height,
	}
	slot.Status = domain.IllustrationStatusReady
	slot.ErrorMessage = nil
	return slot, nil
}

type rssImageMeta struct {
	URL    string
	Width  int
	Height int
}

func tryRSSImage(ctx context.Context, fetcher *cover.Fetcher, imageURL string) (rssImageMeta, bool) {
	data, _, err := fetcher.FetchFirst(ctx, imageURL)
	if err != nil || len(data) == 0 || len(data) > 1<<20 {
		return rssImageMeta{}, false
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width < minIllustrationWidth {
		return rssImageMeta{}, false
	}
	return rssImageMeta{URL: imageURL, Width: cfg.Width, Height: cfg.Height}, true
}

func loadEditorFromStep(ctx context.Context, repo *mysql.PipelineRepository, runID string) (domain.EditorOutput, error) {
	step, err := repo.GetStepDetail(ctx, runID, domain.StepEditor)
	if err != nil {
		return domain.EditorOutput{}, err
	}
	var out domain.EditorOutput
	if len(step.OutputJSON) > 0 {
		if err := json.Unmarshal(step.OutputJSON, &out); err == nil && out.Topic != "" {
			return out, nil
		}
	}
	return domain.EditorOutput{Topic: "科技资讯"}, nil
}
