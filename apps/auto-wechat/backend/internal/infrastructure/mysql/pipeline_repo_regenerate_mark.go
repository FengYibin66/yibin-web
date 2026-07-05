package mysql

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (r *PipelineRepository) MarkStepsRegeneratingFrom(ctx context.Context, runID string, fromStep domain.PipelineStep) error {
	// Publish is manual; only show running when explicitly regenerating publish.
	query := fmt.Sprintf(`
		UPDATE pipeline_run_steps
		SET status = 'running',
		    error_message = NULL,
		    output_json = NULL,
		    duration_ms = NULL,
		    started_at = CURRENT_TIMESTAMP(3),
		    finished_at = NULL
		WHERE run_id = ?
		  AND %s >= %s
		  AND (step <> 'publish' OR ? = 'publish')
	`, pipelineStepField, pipelineStepFieldParam)

	if _, err := r.db.ExecContext(ctx, query, runID, string(fromStep), string(fromStep)); err != nil {
		return fmt.Errorf("mark steps regenerating from %s: %w", fromStep, err)
	}
	return nil
}
