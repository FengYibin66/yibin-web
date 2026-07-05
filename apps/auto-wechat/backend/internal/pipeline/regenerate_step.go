package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

func (e *Engine) RegenerateStep(ctx context.Context, runID string, target domain.PipelineStep) error {
	log.Printf("regenerate cascade run_id=%s from_step=%s", runID, target)

	job := runJobID("regenerate", string(target))
	return e.withActiveJob(ctx, runID, job, func(ctx context.Context) error {
		if e.abortIfRunDeleted(ctx, runID) {
			return nil
		}
		if err := e.PrepareRegenerate(ctx, runID, target); err != nil {
			if isRunNotFound(err) {
				return nil
			}
			return err
		}

		if err := e.runCascadeFrom(ctx, runID, target); err != nil {
			return e.failRun(ctx, runID, err)
		}

		if e.abortIfRunDeleted(ctx, runID) {
			return nil
		}
		return e.reconcileRunStatus(ctx, runID)
	})
}

func (e *Engine) regenerateCover(ctx context.Context, runID string) error {
	writerOut, err := e.loadWriterOutput(ctx, runID)
	if err != nil {
		return err
	}
	layoutOut, err := e.loadLayoutOutput(ctx, runID)
	if err != nil {
		return err
	}
	editorOut, err := e.loadEditorOutput(ctx, runID)
	if err != nil {
		return err
	}
	items, err := e.loadDigestItems(ctx, runID)
	if err != nil {
		return err
	}
	articles, _ := e.fetchArticles(ctx)
	coverOut, err := e.runCover(ctx, runID, layoutOut, writerOut, editorOut, items, articles)
	if err != nil {
		return err
	}
	if coverOut.CoverImageURL != "" {
		draft, err := e.draftRepo.GetByRunID(ctx, runID)
		if err != nil {
			return err
		}
		coverPtr := coverOut.CoverImageURL
		if _, err := e.draftRepo.Update(ctx, draft.ID, domain.UpdateDraftInput{CoverURL: &coverPtr}); err != nil {
			return err
		}
	}
	return e.reconcileRunStatus(ctx, runID)
}

func (e *Engine) regeneratePublish(ctx context.Context, runID string) error {
	draft, err := e.draftRepo.GetByRunID(ctx, runID)
	if err != nil {
		return fmt.Errorf("content draft required before publish: %w", err)
	}
	if draft.BodyHTML == "" {
		return fmt.Errorf("body_html is empty")
	}

	publishMode, err := e.pipelineRepo.GetRunPublishMode(ctx, runID)
	if err != nil {
		return err
	}

	layoutOut := domain.LayoutOutput{
		Title:         draft.Title,
		BodyHTML:      draft.BodyHTML,
		CoverImageURL: draft.CoverURL,
	}

	articles, _ := e.fetchArticles(ctx)
	_, err = e.runPublish(ctx, runID, publishMode, draft, layoutOut, articles)
	return err
}

func (e *Engine) loadRankedInput(ctx context.Context, runID string) ([]domain.RankedItem, error) {
	if digest, err := e.digestRepo.GetByRunID(ctx, runID); err == nil && len(digest.Items) > 0 {
		return digest.Items, nil
	}

	rankStep, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepRank)
	if err != nil {
		return nil, fmt.Errorf("rank output not found: run collect/rank first")
	}
	items, parseErr := parseRankedItemsFromStep(rankStep.OutputJSON)
	if parseErr != nil || len(items) == 0 {
		return nil, fmt.Errorf("ranked items unavailable, regenerate rank first")
	}
	return items, nil
}

func (e *Engine) loadDigestItems(ctx context.Context, runID string) ([]domain.RankedItem, error) {
	digest, err := e.digestRepo.GetByRunID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("digest not found: run enrich first")
	}
	if len(digest.Items) == 0 {
		return nil, fmt.Errorf("digest items empty")
	}
	return digest.Items, nil
}

func (e *Engine) loadEditorOutput(ctx context.Context, runID string) (domain.EditorOutput, error) {
	if out, err := e.loadEditorFromStep(ctx, runID); err == nil {
		return out, nil
	}
	if draft, err := e.draftRepo.GetByRunID(ctx, runID); err == nil && len(draft.EditorJSON) > 0 {
		return mapToEditorOutput(draft.EditorJSON)
	}
	return domain.EditorOutput{}, fmt.Errorf("editor output not found")
}

func (e *Engine) loadEditorFromStep(ctx context.Context, runID string) (domain.EditorOutput, error) {
	step, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepEditor)
	if err != nil || len(step.OutputJSON) == 0 {
		return domain.EditorOutput{}, fmt.Errorf("editor step output empty")
	}
	var output map[string]any
	if err := json.Unmarshal(step.OutputJSON, &output); err != nil {
		return domain.EditorOutput{}, err
	}
	return parseEditorOutput(output)
}

func (e *Engine) loadWriterOutput(ctx context.Context, runID string) (domain.WriterOutput, error) {
	if out, err := e.loadWriterFromStep(ctx, runID); err == nil {
		return out, nil
	}
	if draft, err := e.draftRepo.GetByRunID(ctx, runID); err == nil && draft.BodyMarkdown != "" {
		return domain.WriterOutput{
			Title:        draft.Title,
			Summary:      draft.Summary,
			BodyMarkdown: draft.BodyMarkdown,
		}, nil
	}
	return domain.WriterOutput{}, fmt.Errorf("writer output not found")
}

func (e *Engine) loadWriterFromStep(ctx context.Context, runID string) (domain.WriterOutput, error) {
	step, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepWriter)
	if err != nil || len(step.OutputJSON) == 0 {
		return domain.WriterOutput{}, fmt.Errorf("writer step output empty")
	}
	var output map[string]any
	if err := json.Unmarshal(step.OutputJSON, &output); err != nil {
		return domain.WriterOutput{}, err
	}
	return parseWriterOutput(output)
}

func (e *Engine) loadLayoutOutput(ctx context.Context, runID string) (domain.LayoutOutput, error) {
	if out, err := e.loadLayoutFromStep(ctx, runID); err == nil {
		return out, nil
	}
	if draft, err := e.draftRepo.GetByRunID(ctx, runID); err == nil && draft.BodyHTML != "" {
		return domain.LayoutOutput{
			Title:         draft.Title,
			CoverImageURL: draft.CoverURL,
			BodyHTML:      draft.BodyHTML,
		}, nil
	}
	return domain.LayoutOutput{}, fmt.Errorf("layout output not found")
}

func (e *Engine) loadLayoutFromStep(ctx context.Context, runID string) (domain.LayoutOutput, error) {
	step, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepLayout)
	if err != nil || len(step.OutputJSON) == 0 {
		return domain.LayoutOutput{}, fmt.Errorf("layout step output empty")
	}
	var output map[string]any
	if err := json.Unmarshal(step.OutputJSON, &output); err != nil {
		return domain.LayoutOutput{}, err
	}
	return parseLayoutOutputFromMap(output)
}

func (e *Engine) upsertDigest(ctx context.Context, runID string, items []domain.RankedItem) error {
	existing, err := e.digestRepo.GetByRunID(ctx, runID)
	if err == mysql.ErrNotFound {
		_, err = e.digestRepo.Create(ctx, runID, items, map[string]any{"regenerated": true})
		return err
	}
	if err != nil {
		return err
	}
	_, err = e.digestRepo.UpdateItems(ctx, existing.ID, items)
	return err
}

func (e *Engine) syncDraftFromSteps(ctx context.Context, runID string) error {
	writerStep, writerErr := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepWriter)
	layoutStep, layoutErr := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepLayout)
	if writerErr != nil && layoutErr != nil {
		return nil
	}

	writerOut := parseStepOutputMap(writerStep.OutputJSON)
	layoutOut := parseStepOutputMap(layoutStep.OutputJSON)

	title := firstNonEmptyStr(
		stringField(layoutOut, "title"),
		stringField(writerOut, "title"),
	)
	summary := stringField(writerOut, "summary")
	bodyMarkdown := stringField(writerOut, "bodyMarkdown")
	bodyHTML := wechatarticle.EnhanceBodyHTML(stringField(layoutOut, "bodyHtml"))
	coverURL := stringField(layoutOut, "coverImageUrl")
	if coverStep, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepCover); err == nil {
		coverOut := parseStepOutputMap(coverStep.OutputJSON)
		if u := stringField(coverOut, "coverImageUrl"); u != "" {
			coverURL = u
		}
	}

	if bodyHTML == "" && bodyMarkdown == "" {
		return nil
	}

	editorJSON := map[string]any{}
	if editorStep, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepEditor); err == nil {
		editorJSON = parseStepOutputMap(editorStep.OutputJSON)
	}
	reviewJSON := map[string]any{}
	if reviewStep, err := e.pipelineRepo.GetStepDetail(ctx, runID, domain.StepReview); err == nil {
		reviewJSON = parseStepOutputMap(reviewStep.OutputJSON)
	}

	var digestID string
	if digest, err := e.digestRepo.GetByRunID(ctx, runID); err == nil {
		digestID = digest.ID
	}

	draft, err := e.draftRepo.GetByRunID(ctx, runID)
	if err == mysql.ErrNotFound {
		_, err = e.draftRepo.Create(ctx, domain.ContentDraft{
			RunID:        runID,
			DigestID:     digestID,
			Title:        title,
			Summary:      summary,
			BodyMarkdown: bodyMarkdown,
			BodyHTML:     bodyHTML,
			CoverURL:     coverURL,
			Status:       "draft",
			EditorJSON:   editorJSON,
			ReviewJSON:   reviewJSON,
		})
		if err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else {
		titlePtr, summaryPtr, mdPtr, htmlPtr, coverPtr := title, summary, bodyMarkdown, bodyHTML, coverURL
		if _, err := e.draftRepo.Update(ctx, draft.ID, domain.UpdateDraftInput{
			Title:        &titlePtr,
			Summary:      &summaryPtr,
			BodyMarkdown: &mdPtr,
			BodyHTML:     &htmlPtr,
			CoverURL:     &coverPtr,
		}); err != nil {
			return err
		}
	}

	if bodyHTML != "" {
		html := bodyHTML
		_ = e.pipelineRepo.UpdateRunArtifacts(ctx, runID, nil, &html)
	}
	return nil
}

func parseRankedItemsFromStep(raw json.RawMessage) ([]domain.RankedItem, error) {
	var output map[string]any
	if err := json.Unmarshal(raw, &output); err != nil {
		return nil, err
	}
	if items, ok := output["items"].([]any); ok {
		return parseRankedItems(map[string]any{"items": items})
	}
	return nil, fmt.Errorf("no ranked items in step output")
}

func mapToEditorOutput(m map[string]any) (domain.EditorOutput, error) {
	data, err := json.Marshal(m)
	if err != nil {
		return domain.EditorOutput{}, err
	}
	var result domain.EditorOutput
	if err := json.Unmarshal(data, &result); err != nil {
		return domain.EditorOutput{}, err
	}
	return result, nil
}

func parseStepOutputMap(raw json.RawMessage) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		return map[string]any{}
	}
	return result
}
