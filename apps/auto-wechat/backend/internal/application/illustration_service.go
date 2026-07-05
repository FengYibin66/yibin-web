package application

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/cover"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

type IllustrationService struct {
	pipelineRepo  *mysql.PipelineRepository
	imageAssets   *ImageAssetService
	coverFetcher  *cover.Fetcher
	regenerator   *IllustrationRegenerator
}

func NewIllustrationService(
	pipelineRepo *mysql.PipelineRepository,
	imageAssets *ImageAssetService,
	coverFetcher *cover.Fetcher,
	regenerator *IllustrationRegenerator,
) *IllustrationService {
	return &IllustrationService{
		pipelineRepo: pipelineRepo,
		imageAssets:  imageAssets,
		coverFetcher: coverFetcher,
		regenerator:  regenerator,
	}
}

func (s *IllustrationService) GetOutput(ctx context.Context, runID string) (domain.IllustrationOutput, error) {
	step, err := s.pipelineRepo.GetStepDetail(ctx, runID, domain.StepIllustrate)
	if err != nil {
		return domain.IllustrationOutput{}, err
	}
	if len(step.OutputJSON) == 0 {
		return domain.IllustrationOutput{}, fmt.Errorf("illustrate output empty")
	}
	var out domain.IllustrationOutput
	if err := json.Unmarshal(step.OutputJSON, &out); err != nil {
		return domain.IllustrationOutput{}, err
	}
	if out.Stats.Total == 0 && len(out.Slots) > 0 {
		out.Stats = computeIllustrationStats(out.Slots)
	}
	return out, nil
}

func (s *IllustrationService) RegenerateSlot(ctx context.Context, runID, slotID, mode string) (domain.IllustrationOutput, error) {
	if s.regenerator == nil {
		return domain.IllustrationOutput{}, fmt.Errorf("illustration regenerator not configured")
	}
	return s.regenerator.RegenerateIllustrationSlot(ctx, runID, slotID, mode)
}

func (s *IllustrationService) IngestSlot(ctx context.Context, runID, slotID string) (domain.IllustrationOutput, domain.ImageAsset, error) {
	out, err := s.GetOutput(ctx, runID)
	if err != nil {
		return domain.IllustrationOutput{}, domain.ImageAsset{}, err
	}

	idx := findSlotIndex(out.Slots, slotID)
	if idx < 0 {
		return domain.IllustrationOutput{}, domain.ImageAsset{}, fmt.Errorf("slot not found: %s", slotID)
	}
	slot := out.Slots[idx]
	if slot.Status != domain.IllustrationStatusReady || slot.Image.URL == "" {
		return domain.IllustrationOutput{}, domain.ImageAsset{}, fmt.Errorf("slot has no ready image")
	}
	if slot.Image.InLibrary && slot.Image.AssetID != nil {
		asset, err := s.imageAssets.GetByID(ctx, *slot.Image.AssetID)
		return out, asset, err
	}

	data, filename, err := s.coverFetcher.FetchFirst(ctx, slot.Image.URL)
	if err != nil {
		return domain.IllustrationOutput{}, domain.ImageAsset{}, err
	}
	mimeType := "image/jpeg"
	if len(filename) > 4 && filename[len(filename)-4:] == ".png" {
		mimeType = "image/png"
	}

	source := domain.ImageSource(slot.Image.Source)
	if source == "" {
		source = domain.ImageSourceScraped
	}
	asset, _, err := s.imageAssets.Ingest(ctx, domain.IngestImageInput{
		Name:         slot.BindTo.Headline,
		Source:       source,
		OriginURL:    firstNonEmpty(slot.Image.OriginURL, slot.Image.URL),
		Prompt:       slot.Image.Prompt,
		AutoIngested: false,
		Data:         data,
		MimeType:     mimeType,
		Width:        slot.Image.Width,
		Height:       slot.Image.Height,
		Provenance: domain.ImageProvenance{
			FirstRunID:  runID,
			FirstSlotID: slot.ID,
			Headline:    slot.BindTo.Headline,
		},
	})
	if err != nil {
		return domain.IllustrationOutput{}, domain.ImageAsset{}, err
	}

	assetID := asset.ID
	slot.Image.AssetID = &assetID
	slot.Image.InLibrary = true
	slot.Image.URL = asset.URL
	out.Slots[idx] = slot
	out.Stats = computeIllustrationStats(out.Slots)
	if err := s.saveOutput(ctx, runID, out); err != nil {
		return domain.IllustrationOutput{}, domain.ImageAsset{}, err
	}
	return out, asset, nil
}

func (s *IllustrationService) AssignLibraryAsset(ctx context.Context, runID, slotID, assetID string) (domain.IllustrationOutput, error) {
	asset, err := s.imageAssets.GetByID(ctx, assetID)
	if err != nil {
		return domain.IllustrationOutput{}, err
	}
	_ = s.imageAssets.IncrementUsage(ctx, assetID)

	out, err := s.GetOutput(ctx, runID)
	if err != nil {
		return domain.IllustrationOutput{}, err
	}
	idx := findSlotIndex(out.Slots, slotID)
	if idx < 0 {
		return domain.IllustrationOutput{}, fmt.Errorf("slot not found: %s", slotID)
	}

	slot := out.Slots[idx]
	slot.Image = domain.IllustrationImage{
		AssetID:   &asset.ID,
		InLibrary: true,
		URL:       asset.URL,
		Source:    "library",
		Width:     asset.Width,
		Height:    asset.Height,
	}
	slot.Status = domain.IllustrationStatusReady
	slot.ErrorMessage = nil
	out.Slots[idx] = slot
	out.Stats = computeIllustrationStats(out.Slots)
	if err := s.saveOutput(ctx, runID, out); err != nil {
		return domain.IllustrationOutput{}, err
	}
	return out, nil
}

func (s *IllustrationService) saveOutput(ctx context.Context, runID string, out domain.IllustrationOutput) error {
	raw, err := json.Marshal(out)
	if err != nil {
		return err
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return err
	}
	return s.pipelineRepo.UpdateStepOutput(ctx, runID, domain.StepIllustrate, payload)
}

func findSlotIndex(slots []domain.IllustrationSlot, slotID string) int {
	for i, slot := range slots {
		if slot.ID == slotID {
			return i
		}
	}
	return -1
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

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
