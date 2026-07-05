package pipeline

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (e *Engine) runCascadeFrom(ctx context.Context, runID string, target domain.PipelineStep) error {
	if target == domain.StepPublish {
		return e.regeneratePublish(ctx, runID)
	}

	var (
		articles []domain.Article
		ranked   []domain.RankedItem
		enriched []domain.RankedItem
		digest   domain.Digest
		err      error
	)

	if domain.IsStepAtOrAfter(domain.StepCollect, target) {
		articles, _, err = e.runCollect(ctx, runID)
		if err != nil {
			return err
		}
	}

	if domain.IsStepAtOrAfter(domain.StepRank, target) {
		if articles == nil {
			articles, err = e.fetchArticles(ctx)
			if err != nil {
				return err
			}
		}
		ranked, _, _, err = e.runRank(ctx, runID, articles)
		if err != nil {
			return err
		}
	}

	if domain.IsStepAtOrAfter(domain.StepEnrich, target) {
		if ranked == nil {
			ranked, err = e.loadRankedInput(ctx, runID)
			if err != nil {
				return err
			}
		}
		if articles == nil {
			articles, err = e.fetchArticles(ctx)
			if err != nil {
				return err
			}
		}
		enriched, _, err = e.runEnrich(ctx, runID, ranked, articles)
		if err != nil {
			return err
		}
		if err := e.upsertDigest(ctx, runID, enriched); err != nil {
			return err
		}
	}

	if domain.IsStepAtOrAfter(domain.StepEditor, target) {
		digest, err = e.loadDigest(ctx, runID)
		if err != nil {
			return err
		}
		if articles == nil {
			articles, _ = e.fetchArticles(ctx)
		}
		editorOut, writerOut, layoutOut, reviewOut, _, contentErr := e.runContentPipeline(ctx, runID, digest, articles)
		if contentErr != nil {
			return contentErr
		}
		return e.finalizeThroughCover(ctx, runID, digest, articles, layoutOut, writerOut, editorOut, reviewOut)
	}

	if domain.IsStepAtOrAfter(domain.StepWriter, target) {
		digest, err = e.loadDigest(ctx, runID)
		if err != nil {
			return err
		}
		if articles == nil {
			articles, _ = e.fetchArticles(ctx)
		}
		editorOut, err := e.loadEditorOutput(ctx, runID)
		if err != nil {
			return err
		}
		writerOut, _, err := e.runWriter(ctx, runID, digest.Items, editorOut, "")
		if err != nil {
			return err
		}
		layoutOut, reviewOut, err := e.runLayoutAndReview(ctx, runID, writerOut, editorOut, digest.Items, articles)
		if err != nil {
			return err
		}
		return e.finalizeThroughCover(ctx, runID, digest, articles, layoutOut, writerOut, editorOut, reviewOut)
	}

	if domain.StepIndex(target) == domain.StepIndex(domain.StepIllustrate) {
		digest, err := e.loadDigest(ctx, runID)
		if err != nil {
			return err
		}
		writerOut, err := e.loadWriterOutput(ctx, runID)
		if err != nil {
			return err
		}
		editorOut, err := e.loadEditorOutput(ctx, runID)
		if err != nil {
			return err
		}
		if articles == nil {
			articles, _ = e.fetchArticles(ctx)
		}
		if _, _, err := e.runIllustrate(ctx, runID, digest.Items, articles, editorOut); err != nil {
			return err
		}
		layoutOut, reviewOut, err := e.runLayoutAndReview(ctx, runID, writerOut, editorOut, digest.Items, articles)
		if err != nil {
			return err
		}
		return e.finalizeThroughCover(ctx, runID, digest, articles, layoutOut, writerOut, editorOut, reviewOut)
	}

	if domain.IsStepAtOrAfter(domain.StepLayout, target) {
		digest, err = e.loadDigest(ctx, runID)
		if err != nil {
			return err
		}
		writerOut, err := e.loadWriterOutput(ctx, runID)
		if err != nil {
			return err
		}
		if articles == nil {
			articles, _ = e.fetchArticles(ctx)
		}
		editorOut, err := e.loadEditorOutput(ctx, runID)
		if err != nil {
			return err
		}
		layoutOut, reviewOut, err := e.runLayoutAndReview(ctx, runID, writerOut, editorOut, digest.Items, articles)
		if err != nil {
			return err
		}
		return e.finalizeThroughCover(ctx, runID, digest, articles, layoutOut, writerOut, editorOut, reviewOut)
	}

	if domain.IsStepAtOrAfter(domain.StepReview, target) && domain.StepIndex(target) == domain.StepIndex(domain.StepReview) {
		digest, err = e.loadDigest(ctx, runID)
		if err != nil {
			return err
		}
		writerOut, err := e.loadWriterOutput(ctx, runID)
		if err != nil {
			return err
		}
		layoutOut, err := e.loadLayoutOutput(ctx, runID)
		if err != nil {
			return err
		}
		reviewOut, _, err := e.runReview(ctx, runID, writerOut, layoutOut, 1)
		if err != nil {
			return err
		}
		editorOut, _ := e.loadEditorOutput(ctx, runID)
		if articles == nil {
			articles, _ = e.fetchArticles(ctx)
		}
		return e.finalizeThroughCover(ctx, runID, digest, articles, layoutOut, writerOut, editorOut, reviewOut)
	}

	if domain.StepIndex(target) == domain.StepIndex(domain.StepCover) {
		return e.regenerateCover(ctx, runID)
	}

	return fmt.Errorf("unsupported cascade step: %s", target)
}

func (e *Engine) loadDigest(ctx context.Context, runID string) (domain.Digest, error) {
	digest, err := e.digestRepo.GetByRunID(ctx, runID)
	if err != nil {
		return domain.Digest{}, fmt.Errorf("digest not found: run enrich first")
	}
	if len(digest.Items) == 0 {
		return domain.Digest{}, fmt.Errorf("digest items empty")
	}
	return digest, nil
}

func (e *Engine) runLayoutAndReview(
	ctx context.Context,
	runID string,
	writer domain.WriterOutput,
	editor domain.EditorOutput,
	items []domain.RankedItem,
	articles []domain.Article,
) (domain.LayoutOutput, domain.ReviewOutput, error) {
	illustrateOut, err := e.ensureIllustrationOutput(ctx, runID, items, articles, editor)
	if err != nil {
		return domain.LayoutOutput{}, domain.ReviewOutput{}, err
	}
	layoutOut, _, err := e.runLayout(ctx, runID, writer, editor, illustrateOut, items, articles, "")
	if err != nil {
		return domain.LayoutOutput{}, domain.ReviewOutput{}, err
	}
	reviewOut, _, err := e.runReview(ctx, runID, writer, layoutOut, 1)
	if err != nil {
		return domain.LayoutOutput{}, domain.ReviewOutput{}, err
	}
	return layoutOut, reviewOut, nil
}

func (e *Engine) finalizeThroughCover(
	ctx context.Context,
	runID string,
	digest domain.Digest,
	articles []domain.Article,
	layoutOut domain.LayoutOutput,
	writerOut domain.WriterOutput,
	editorOut domain.EditorOutput,
	reviewOut domain.ReviewOutput,
) error {
	if layoutOut.BodyHTML != "" {
		if err := e.syncDraftFromSteps(ctx, runID); err != nil {
			return err
		}
		html := layoutOut.BodyHTML
		if err := e.pipelineRepo.UpdateRunArtifacts(ctx, runID, nil, &html); err != nil {
			return err
		}
	}

	coverOut, err := e.runCover(ctx, runID, layoutOut, writerOut, editorOut, digest.Items, articles)
	if err != nil {
		return err
	}

	if layoutOut.BodyHTML != "" {
		draft, err := e.draftRepo.GetByRunID(ctx, runID)
		if err != nil {
			return err
		}
		if coverOut.CoverImageURL != "" {
			coverPtr := coverOut.CoverImageURL
			if _, err := e.draftRepo.Update(ctx, draft.ID, domain.UpdateDraftInput{CoverURL: &coverPtr}); err != nil {
				return err
			}
		}
	}

	if err := e.pipelineRepo.ResetPublishToPending(ctx, runID); err != nil {
		return err
	}
	return e.reconcileRunStatus(ctx, runID)
}
