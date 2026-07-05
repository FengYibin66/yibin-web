package mysql

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (r *PipelineRepository) ResetStepsFrom(ctx context.Context, runID string, fromStep domain.PipelineStep) error {
	query := fmt.Sprintf(`
		UPDATE pipeline_run_steps
		SET status = 'pending',
		    error_message = NULL,
		    output_json = NULL,
		    duration_ms = NULL,
		    started_at = NULL,
		    finished_at = NULL
		WHERE run_id = ?
		  AND %s >= %s
	`, pipelineStepField, pipelineStepFieldParam)

	result, err := r.db.ExecContext(ctx, query, runID, string(fromStep))
	if err != nil {
		return fmt.Errorf("reset steps from %s: %w", fromStep, err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}
