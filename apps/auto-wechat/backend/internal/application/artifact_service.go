package application

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/cover"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/wechat"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

type ArtifactService struct {
	pipelineRepo *mysql.PipelineRepository
	digestRepo   *mysql.DigestRepository
	draftRepo    *mysql.ContentDraftRepository
	wechatClient *wechat.Client
	coverFetcher *cover.Fetcher
	enqueuer           RunEnqueuer
	publicAPIBaseURL    string
	wechatReadSourceURL      string
	readSourcePresetService  *ReadSourcePresetService
}

func NewArtifactService(
	pipelineRepo *mysql.PipelineRepository,
	digestRepo *mysql.DigestRepository,
	draftRepo *mysql.ContentDraftRepository,
	wechatClient *wechat.Client,
	coverFetcher *cover.Fetcher,
	enqueuer RunEnqueuer,
	publicAPIBaseURL string,
	wechatReadSourceURL string,
	readSourcePresetService *ReadSourcePresetService,
) *ArtifactService {
	return &ArtifactService{
		pipelineRepo:     pipelineRepo,
		digestRepo:       digestRepo,
		draftRepo:        draftRepo,
		wechatClient:     wechatClient,
		coverFetcher:     coverFetcher,
		enqueuer:         enqueuer,
		publicAPIBaseURL:    publicAPIBaseURL,
		wechatReadSourceURL:     wechatReadSourceURL,
		readSourcePresetService: readSourcePresetService,
	}
}

func (s *ArtifactService) GetArtifacts(ctx context.Context, runID string) (domain.RunArtifacts, error) {
	run, err := s.pipelineRepo.GetRun(ctx, runID)
	if err != nil {
		return domain.RunArtifacts{}, err
	}

	steps, err := s.pipelineRepo.ListStepDetails(ctx, runID)
	if err != nil {
		return domain.RunArtifacts{}, err
	}

	artifacts := domain.RunArtifacts{
		RunID:        runID,
		RunStatus:    run.Status,
		PublishMode:  run.PublishMode,
		Steps:        steps,
		DraftMediaID: run.DraftMediaID,
		PreviewHTML:  run.PreviewHTML,
	}

	if digest, err := s.digestRepo.GetByRunID(ctx, runID); err == nil {
		artifacts.Digest = &digest
	}

	if draft, err := s.ensureDraft(ctx, runID); err == nil {
		artifacts.ContentDraft = &draft
	}

	if record, err := s.draftRepo.GetPublishResultByRunID(ctx, runID); err == nil {
		artifacts.PublishResult = &record
	}

	return artifacts, nil
}

func (s *ArtifactService) GetStep(ctx context.Context, runID string, step domain.PipelineStep) (domain.StepDetail, error) {
	return s.pipelineRepo.GetStepDetail(ctx, runID, step)
}

func (s *ArtifactService) RegenerateStep(ctx context.Context, runID string, step domain.PipelineStep, replace bool) error {
	if domain.StepIndex(step) < 0 {
		return fmt.Errorf("unsupported step: %s", step)
	}
	run, err := s.pipelineRepo.GetRun(ctx, runID)
	if err != nil {
		return err
	}
	// Only heal stale running rows; inconsistent-order heal runs on GetRun reads.
	// Full HealRunSteps here used to mark layout failed while downstream was also running (regenerate).
	if _, err := s.pipelineRepo.HealStaleRunningSteps(ctx, runID); err != nil {
		return err
	}

	needsReplace, err := s.runNeedsReplaceConfirm(ctx, run)
	if err != nil {
		return err
	}
	if needsReplace && !replace {
		return ErrRunReplaceRequired
	}

	if s.enqueuer != nil {
		if err := s.enqueuer.CancelRunTasks(ctx, runID); err != nil {
			return fmt.Errorf("cancel run tasks: %w", err)
		}
	}
	if err := s.pipelineRepo.ClearActiveJob(ctx, runID); err != nil {
		return err
	}

	if err := s.prepareRegenerate(ctx, runID, step); err != nil {
		return err
	}
	if s.enqueuer == nil {
		return fmt.Errorf("step regenerate enqueuer not configured")
	}
	return s.enqueuer.EnqueuePipelineStepRegenerate(ctx, runID, string(step))
}

func (s *ArtifactService) runNeedsReplaceConfirm(ctx context.Context, run domain.PipelineRun) (bool, error) {
	if run.Status == domain.RunStatusRunning || run.Status == domain.RunStatusQueued {
		return true, nil
	}
	busy, err := s.pipelineRepo.HasActiveJob(ctx, run.ID)
	if err != nil {
		return false, err
	}
	if busy {
		return true, nil
	}
	steps, err := s.pipelineRepo.ListStepDetails(ctx, run.ID)
	if err != nil {
		return false, err
	}
	for _, step := range steps {
		if step.Status == domain.StepStatusRunning {
			return true, nil
		}
	}
	return false, nil
}

func (s *ArtifactService) prepareRegenerate(ctx context.Context, runID string, target domain.PipelineStep) error {
	if err := s.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusRunning, nil); err != nil {
		return err
	}
	if err := s.pipelineRepo.ResetStepsFrom(ctx, runID, target); err != nil {
		return err
	}
	if err := s.pipelineRepo.InvalidateDownstreamArtifacts(ctx, runID, target); err != nil {
		return err
	}
	if err := s.draftRepo.InvalidateDownstreamContent(ctx, runID, target); err != nil {
		return err
	}
	if domain.IsStepAtOrBefore(target, domain.StepEnrich) {
		if digest, err := s.digestRepo.GetByRunID(ctx, runID); err == nil {
			_, _ = s.digestRepo.UpdateItems(ctx, digest.ID, nil)
		}
	}
	return s.pipelineRepo.MarkStepsRegeneratingFrom(ctx, runID, target)
}

func (s *ArtifactService) UpdateDraft(ctx context.Context, runID string, input domain.UpdateDraftInput) (domain.ContentDraft, error) {
	draft, err := s.ensureDraft(ctx, runID)
	if err != nil {
		return domain.ContentDraft{}, err
	}

	updated, err := s.draftRepo.Update(ctx, draft.ID, input)
	if err != nil {
		return domain.ContentDraft{}, err
	}

	if input.BodyHTML != nil {
		if err := s.pipelineRepo.UpdateRunArtifacts(ctx, runID, nil, input.BodyHTML); err != nil {
			return domain.ContentDraft{}, err
		}
	}

	return updated, nil
}

func (s *ArtifactService) UpdateDigestItems(ctx context.Context, runID string, items []domain.RankedItem) (domain.Digest, error) {
	digest, err := s.digestRepo.GetByRunID(ctx, runID)
	if err != nil {
		return domain.Digest{}, err
	}
	return s.digestRepo.UpdateItems(ctx, digest.ID, items)
}

func (s *ArtifactService) PublishRun(ctx context.Context, runID string, input domain.PublishRunInput) (domain.PublishRecord, error) {
	run, err := s.pipelineRepo.GetRun(ctx, runID)
	if err != nil {
		return domain.PublishRecord{}, err
	}

	draft, err := s.ensureDraft(ctx, runID)
	if err != nil {
		return domain.PublishRecord{}, fmt.Errorf("content draft not found: %w", err)
	}
	if input.ReadSourcePresetID != nil && *input.ReadSourcePresetID != "" {
		draft, err = s.draftRepo.Update(ctx, draft.ID, domain.UpdateDraftInput{
			ReadSourcePresetID: input.ReadSourcePresetID,
		})
		if err != nil {
			return domain.PublishRecord{}, err
		}
	}
	if draft.BodyHTML == "" {
		return domain.PublishRecord{}, fmt.Errorf("body_html is empty, save draft before publish")
	}

	start := time.Now()
	if err := s.pipelineRepo.FinishStep(ctx, runID, domain.StepPublish, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return domain.PublishRecord{}, err
	}

	publishMode := run.PublishMode
	if publishMode == "" {
		publishMode = domain.PublishModeDraftOnly
	}

	record, err := s.publishDraft(ctx, runID, publishMode, draft, start)
	if err != nil {
		msg := err.Error()
		duration := int(time.Since(start).Milliseconds())
		_ = s.pipelineRepo.FinishStep(ctx, runID, domain.StepPublish, domain.StepStatusFailed, &msg, nil, &duration)
		return domain.PublishRecord{}, err
	}

	if err := s.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusSucceeded, nil); err != nil {
		return domain.PublishRecord{}, err
	}

	return record, nil
}

func (s *ArtifactService) publishDraft(
	ctx context.Context,
	runID, publishMode string,
	draft domain.ContentDraft,
	start time.Time,
) (domain.PublishRecord, error) {
	output := map[string]any{"publishMode": publishMode, "manual": true}

	switch publishMode {
	case domain.PublishModeCopyHTML:
		output["mode"] = "copy_html"
		duration := int(time.Since(start).Milliseconds())
		if err := s.pipelineRepo.FinishStep(ctx, runID, domain.StepPublish, domain.StepStatusSucceeded, nil, mustJSON(output), &duration); err != nil {
			return domain.PublishRecord{}, err
		}
		return domain.PublishRecord{PublishMode: publishMode}, nil
	default:
		if !s.wechatClient.Enabled() {
			return domain.PublishRecord{}, fmt.Errorf("wechat credentials not configured")
		}

		coverData, _, err := s.coverFetcher.FetchFirst(ctx, draft.CoverURL)
		if err != nil {
			return domain.PublishRecord{}, fmt.Errorf("cover image required for draft/add: %w", err)
		}

		coverData, filename, err := media.PrepareWeChatThumb(coverData)
		if err != nil {
			return domain.PublishRecord{}, fmt.Errorf("prepare cover thumb: %w", err)
		}

		thumbMediaID, err := s.wechatClient.UploadThumb(ctx, filename, coverData)
		if err != nil {
			return domain.PublishRecord{}, err
		}

		bodyHTML, replaceErr := wechatarticle.ReplaceBodyImagesForWeChat(
			ctx, draft.BodyHTML, s.coverFetcher, s.wechatClient,
		)
		if replaceErr != nil {
			return domain.PublishRecord{}, replaceErr
		}

		content, contentSourceURL := s.prepareWeChatArticle(ctx, runID, draft, bodyHTML)
		draftMediaID, err := s.wechatClient.AddDraft(ctx, wechat.DraftArticle{
			Title:            draft.Title,
			Author:           "AI 日报",
			Digest:           truncateRunes(draft.Summary, 120),
			Content:          content,
			ThumbMediaID:     thumbMediaID,
			ContentSourceURL: contentSourceURL,
		})
		if err != nil {
			return domain.PublishRecord{}, err
		}

		_ = s.draftRepo.UpdateCoverMediaID(ctx, draft.ID, thumbMediaID)
		if err := s.draftRepo.SavePublishResult(ctx, draft.ID, draftMediaID, publishMode); err != nil {
			return domain.PublishRecord{}, err
		}
		if err := s.pipelineRepo.UpdateRunArtifacts(ctx, runID, &draftMediaID, nil); err != nil {
			return domain.PublishRecord{}, err
		}

		output["mode"] = "draft_only"
		output["draftMediaId"] = draftMediaID
		output["thumbMediaId"] = thumbMediaID
		duration := int(time.Since(start).Milliseconds())
		if err := s.pipelineRepo.FinishStep(ctx, runID, domain.StepPublish, domain.StepStatusSucceeded, nil, mustJSON(output), &duration); err != nil {
			return domain.PublishRecord{}, err
		}

		return domain.PublishRecord{
			DraftMediaID: draftMediaID,
			PublishMode:  publishMode,
		}, nil
	}
}

func (s *ArtifactService) prepareWeChatArticle(ctx context.Context, runID string, draft domain.ContentDraft, bodyHTML string) (string, string) {
	content := wechatarticle.EnhanceBodyHTML(bodyHTML)

	var writer domain.WriterOutput
	if step, err := s.pipelineRepo.GetStepDetail(ctx, runID, domain.StepWriter); err == nil && len(step.OutputJSON) > 0 {
		_ = json.Unmarshal(step.OutputJSON, &writer)
	}

	var items []domain.RankedItem
	if digest, err := s.digestRepo.GetByRunID(ctx, runID); err == nil {
		items = digest.Items
	}

	refs := wechatarticle.CollectSourceRefs(writer, items)
	lookup := s.readSourcePresetLookup()
	selected := wechatarticle.SelectedReadSourceURL(ctx, lookup, draft)
	sourceURL := wechatarticle.ResolveContentSourceURL(s.publicAPIBaseURL, s.wechatReadSourceURL, runID, refs, selected)
	return content, sourceURL
}

func (s *ArtifactService) readSourcePresetLookup() wechatarticle.ReadSourcePresetLookup {
	if s.readSourcePresetService == nil {
		return nil
	}
	svc := s.readSourcePresetService
	return wechatarticle.NewReadSourcePresetLookup(svc.URLForPresetID, svc.FirstPresetURL)
}

func mustJSON(value map[string]any) []byte {
	data, err := json.Marshal(value)
	if err != nil {
		return []byte("{}")
	}
	return data
}

func truncateRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}
