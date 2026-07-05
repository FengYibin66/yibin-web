package pipeline

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/wechat"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

func (e *Engine) runPublish(
	ctx context.Context,
	runID string,
	publishMode string,
	draft domain.ContentDraft,
	layout domain.LayoutOutput,
	articles []domain.Article,
) (map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepPublish, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return nil, err
	}

	output := map[string]any{"publishMode": publishMode}

	switch publishMode {
	case domain.PublishModeCopyHTML:
		output["mode"] = "copy_html"
		if err := e.finishStepSucceeded(ctx, runID, domain.StepPublish, start, output); err != nil {
			return nil, err
		}
		return output, nil
	default:
		if !e.wechatClient.Enabled() {
			err := fmt.Errorf("wechat credentials not configured")
			e.finishStepFailed(ctx, runID, domain.StepPublish, start, err)
			return nil, err
		}

		coverURLs := []string{draft.CoverURL, layout.CoverImageURL}
		for _, article := range articles {
			if article.ImageURL != "" {
				coverURLs = append(coverURLs, article.ImageURL)
			}
		}

		coverData, _, err := e.coverFetcher.FetchFirst(ctx, coverURLs...)
		if err != nil {
			log.Printf("cover fetch failed run_id=%s: %v", runID, err)
			err = fmt.Errorf("cover image required for draft/add: %w", err)
			e.finishStepFailed(ctx, runID, domain.StepPublish, start, err)
			return nil, err
		}

		coverData, filename, err := media.PrepareWeChatThumb(coverData)
		if err != nil {
			err = fmt.Errorf("prepare cover thumb: %w", err)
			e.finishStepFailed(ctx, runID, domain.StepPublish, start, err)
			return nil, err
		}

		thumbMediaID, err := e.wechatClient.UploadThumb(ctx, filename, coverData)
		if err != nil {
			e.finishStepFailed(ctx, runID, domain.StepPublish, start, err)
			return nil, err
		}

		bodyHTML := layout.BodyHTML
		replaced, replaceErr := wechatarticle.ReplaceBodyImagesForWeChat(ctx, bodyHTML, e.coverFetcher, e.wechatClient)
		if replaceErr != nil {
			e.finishStepFailed(ctx, runID, domain.StepPublish, start, replaceErr)
			return nil, replaceErr
		}
		content, contentSourceURL := e.prepareWeChatArticle(ctx, runID, draft, replaced)
		draftMediaID, err := e.wechatClient.AddDraft(ctx, wechat.DraftArticle{
			Title:            firstNonEmptyStr(layout.Title, draft.Title),
			Author:           "AI 日报",
			Digest:           truncateRunes(draft.Summary, 120),
			Content:          content,
			ThumbMediaID:     thumbMediaID,
			ContentSourceURL: contentSourceURL,
		})
		if err != nil {
			e.finishStepFailed(ctx, runID, domain.StepPublish, start, err)
			return nil, err
		}

		if err := e.draftRepo.UpdateCoverMediaID(ctx, draft.ID, thumbMediaID); err != nil {
			log.Printf("update cover media id: %v", err)
		}
		if err := e.draftRepo.SavePublishResult(ctx, draft.ID, draftMediaID, publishMode); err != nil {
			log.Printf("save publish result: %v", err)
		}
		if err := e.pipelineRepo.UpdateRunArtifacts(ctx, runID, &draftMediaID, nil); err != nil {
			return nil, err
		}

		output["mode"] = "draft_only"
		output["draftMediaId"] = draftMediaID
		output["thumbMediaId"] = thumbMediaID
		if err := e.finishStepSucceeded(ctx, runID, domain.StepPublish, start, output); err != nil {
			return nil, err
		}
		return output, nil
	}
}

func firstNonEmptyStr(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func truncateRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}
