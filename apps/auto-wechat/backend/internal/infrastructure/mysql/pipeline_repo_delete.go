package mysql

import (
	"context"
	"fmt"
)

func (r *PipelineRepository) ClearActiveJob(ctx context.Context, runID string) error {
	const query = `
		UPDATE pipeline_runs
		SET active_job = NULL,
		    active_job_at = NULL,
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, runID)
	if err != nil {
		return fmt.Errorf("clear active job: %w", err)
	}
	return nil
}

func (r *PipelineRepository) DeleteRun(ctx context.Context, runID string) error {
	const query = `DELETE FROM pipeline_runs WHERE id = ?`
	result, err := r.db.ExecContext(ctx, query, runID)
	if err != nil {
		return fmt.Errorf("delete run: %w", err)
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
