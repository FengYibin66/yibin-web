package mysql

import (
	"context"
	"fmt"
)

// ResetPublishToPending clears a stuck manual publish step after content regeneration.
func (r *PipelineRepository) ResetPublishToPending(ctx context.Context, runID string) error {
	const query = `
		UPDATE pipeline_run_steps
		SET status = 'pending',
		    error_message = NULL,
		    output_json = NULL,
		    duration_ms = NULL,
		    started_at = NULL,
		    finished_at = NULL
		WHERE run_id = ?
		  AND step = 'publish'
		  AND status IN ('running', 'failed')
	`
	if _, err := r.db.ExecContext(ctx, query, runID); err != nil {
		return fmt.Errorf("reset publish to pending: %w", err)
	}
	return nil
}
