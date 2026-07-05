package mysql

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (r *PipelineRepository) InvalidateDownstreamArtifacts(ctx context.Context, runID string, fromStep domain.PipelineStep) error {
	clearPreview := domain.IsStepAtOrBefore(fromStep, domain.StepLayout)
	clearDraftMedia := domain.IsStepAtOrBefore(fromStep, domain.StepPublish)

	if !clearPreview && !clearDraftMedia {
		return nil
	}

	const query = `
		UPDATE pipeline_runs
		SET preview_html = CASE WHEN ? THEN NULL ELSE preview_html END,
		    draft_media_id = CASE WHEN ? THEN NULL ELSE draft_media_id END,
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
	`
	if _, err := r.db.ExecContext(ctx, query, clearPreview, clearDraftMedia, runID); err != nil {
		return fmt.Errorf("invalidate run artifacts: %w", err)
	}
	return nil
}
