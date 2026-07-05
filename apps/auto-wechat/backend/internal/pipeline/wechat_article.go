package pipeline

import (
	"context"
	"encoding/json"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

func (e *Engine) prepareWeChatArticle(ctx context.Context, runID string, draft domain.ContentDraft, bodyHTML string) (content string, contentSourceURL string) {
	content = wechatarticle.EnhanceBodyHTML(bodyHTML)
	writer, items := e.loadWriterAndDigestItems(ctx, runID)
	refs := wechatarticle.CollectSourceRefs(writer, items)
	lookup := e.readSourcePresetLookup()
	selected := wechatarticle.SelectedReadSourceURL(ctx, lookup, draft)
	contentSourceURL = wechatarticle.ResolveContentSourceURL(e.publicAPIBaseURL, e.wechatReadSourceURL, runID, refs, selected)
	return content, contentSourceURL
}

func (e *Engine) readSourcePresetLookup() wechatarticle.ReadSourcePresetLookup {
	if e.readSourcePresetRepo == nil {
		return nil
	}
	repo := e.readSourcePresetRepo
	return wechatarticle.NewReadSourcePresetLookup(
		func(ctx context.Context, presetID string) (string, error) {
			preset, err := repo.GetByID(ctx, presetID)
			if err != nil {
				return "", err
			}
			return preset.URL, nil
		},
		func(ctx context.Context) (string, error) {
			preset, err := repo.First(ctx)
			if err != nil {
				return "", err
			}
			return preset.URL, nil
		},
	)
}

func (e *Engine) loadWriterAndDigestItems(ctx context.Context, runID string) (domain.WriterOutput, []domain.RankedItem) {
	var writer domain.WriterOutput
	if step, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepWriter); err == nil && len(step.OutputJSON) > 0 {
		_ = json.Unmarshal(step.OutputJSON, &writer)
	}

	var items []domain.RankedItem
	if digest, err := e.digestRepo.GetByRunID(ctx, runID); err == nil {
		items = digest.Items
	}
	return writer, items
}
