package mysql

import (
	"context"
	"errors"
	"fmt"
)

var ErrRunBusy = errors.New("run is already being processed")

func (r *PipelineRepository) TryBeginActiveJob(ctx context.Context, runID, job string) error {
	const query = `
		UPDATE pipeline_runs
		SET active_job = ?,
		    active_job_at = CURRENT_TIMESTAMP(3),
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
		  AND (
		        active_job IS NULL
		        OR active_job_at IS NULL
		        OR active_job_at < CURRENT_TIMESTAMP(3) - INTERVAL 2 HOUR
		      )
	`

	result, err := r.db.ExecContext(ctx, query, job, runID)
	if err != nil {
		return fmt.Errorf("begin active job: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("begin active job rows: %w", err)
	}
	if affected == 0 {
		return ErrRunBusy
	}
	return nil
}

func (r *PipelineRepository) EndActiveJob(ctx context.Context, runID, job string) error {
	const query = `
		UPDATE pipeline_runs
		SET active_job = NULL,
		    active_job_at = NULL,
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ? AND active_job = ?
	`
	_, err := r.db.ExecContext(ctx, query, runID, job)
	if err != nil {
		return fmt.Errorf("end active job: %w", err)
	}
	return nil
}

func (r *PipelineRepository) HasActiveJob(ctx context.Context, runID string) (bool, error) {
	const query = `
		SELECT active_job IS NOT NULL
		       AND active_job_at IS NOT NULL
		       AND active_job_at >= CURRENT_TIMESTAMP(3) - INTERVAL 2 HOUR
		FROM pipeline_runs
		WHERE id = ?
	`
	var busy bool
	if err := r.db.QueryRowContext(ctx, query, runID).Scan(&busy); err != nil {
		if errorsIsNoRows(err) {
			return false, ErrNotFound
		}
		return false, fmt.Errorf("has active job: %w", err)
	}
	return busy, nil
}
