package mysql

import (
	"context"
	"fmt"
)

func (r *PipelineRepository) HealStaleRunningSteps(ctx context.Context, runID string) (int, error) {
	const query = `
		UPDATE pipeline_run_steps
		SET status = 'succeeded'
		WHERE run_id = ?
		  AND status = 'running'
		  AND finished_at IS NOT NULL
		  AND output_json IS NOT NULL
	`

	result, err := r.db.ExecContext(ctx, query, runID)
	if err != nil {
		return 0, fmt.Errorf("heal stale running steps: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return int(affected), nil
}

func (r *PipelineRepository) HealInconsistentStepOrder(ctx context.Context, runID string) (int, error) {
	query := fmt.Sprintf(`
		UPDATE pipeline_run_steps AS cur
		INNER JOIN pipeline_run_steps AS later
			ON later.run_id = cur.run_id
			AND FIELD(later.step, %s) > FIELD(cur.step, %s)
			AND later.status = 'succeeded'
		SET cur.status = 'failed',
		    cur.error_message = '步骤状态异常：与下游节点并发执行冲突，请从该节点重新生成',
		    cur.finished_at = COALESCE(cur.finished_at, CURRENT_TIMESTAMP(3))
		WHERE cur.run_id = ?
		  AND cur.status = 'running'
	`, pipelineStepOrder, pipelineStepOrder)

	result, err := r.db.ExecContext(ctx, query, runID)
	if err != nil {
		return 0, fmt.Errorf("heal inconsistent steps: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return int(affected), nil
}

// HealOrphanRunningSteps marks running steps as failed when no worker holds active_job
// (e.g. regenerate task crashed after API optimistically marked steps running).
func (r *PipelineRepository) HealOrphanRunningSteps(ctx context.Context, runID string) (int, error) {
	// Manual publish: if cover already succeeded, reset publish to pending instead of failed.
	const resetPublish = `
		UPDATE pipeline_run_steps AS s
		INNER JOIN pipeline_runs AS r ON r.id = s.run_id
		INNER JOIN pipeline_run_steps AS cover
			ON cover.run_id = s.run_id AND cover.step = 'cover' AND cover.status = 'succeeded'
		SET s.status = 'pending',
		    s.error_message = NULL,
		    s.started_at = NULL,
		    s.finished_at = NULL,
		    s.output_json = NULL,
		    s.duration_ms = NULL
		WHERE s.run_id = ?
		  AND s.step = 'publish'
		  AND s.status = 'running'
		  AND s.finished_at IS NULL
		  AND r.active_job IS NULL
	`
	if _, err := r.db.ExecContext(ctx, resetPublish, runID); err != nil {
		return 0, fmt.Errorf("heal orphan publish: %w", err)
	}

	const query = `
		UPDATE pipeline_run_steps AS s
		INNER JOIN pipeline_runs AS r ON r.id = s.run_id
		SET s.status = 'failed',
		    s.error_message = '步骤执行被中断，请从该节点重新生成',
		    s.finished_at = CURRENT_TIMESTAMP(3)
		WHERE s.run_id = ?
		  AND s.status = 'running'
		  AND s.finished_at IS NULL
		  AND r.active_job IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, runID)
	if err != nil {
		return 0, fmt.Errorf("heal orphan running steps: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return int(affected), nil
}

// HealStaleLockedRunningSteps fails long-running steps when active_job is still held
// (e.g. worker restarted mid LLM call and never cleared the lock).
func (r *PipelineRepository) HealStaleLockedRunningSteps(ctx context.Context, runID string) (int, error) {
	const failSteps = `
		UPDATE pipeline_run_steps AS s
		INNER JOIN pipeline_runs AS r ON r.id = s.run_id
		SET s.status = 'failed',
		    s.error_message = '步骤执行超时或被中断（Worker 可能已重启），请从该节点重新生成',
		    s.finished_at = CURRENT_TIMESTAMP(3)
		WHERE s.run_id = ?
		  AND s.status = 'running'
		  AND s.finished_at IS NULL
		  AND s.started_at IS NOT NULL
		  AND s.started_at < CURRENT_TIMESTAMP(3) - INTERVAL 8 MINUTE
		  AND r.active_job IS NOT NULL
	`
	result, err := r.db.ExecContext(ctx, failSteps, runID)
	if err != nil {
		return 0, fmt.Errorf("heal stale locked running steps: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	if affected == 0 {
		return 0, nil
	}

	const clearLock = `
		UPDATE pipeline_runs
		SET active_job = NULL,
		    active_job_at = NULL,
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
	`
	if _, err := r.db.ExecContext(ctx, clearLock, runID); err != nil {
		return int(affected), fmt.Errorf("clear stale active job: %w", err)
	}
	return int(affected), nil
}

func (r *PipelineRepository) HealRunSteps(ctx context.Context, runID string) error {
	if _, err := r.HealStaleRunningSteps(ctx, runID); err != nil {
		return err
	}
	if _, err := r.HealStaleLockedRunningSteps(ctx, runID); err != nil {
		return err
	}
	if _, err := r.HealOrphanRunningSteps(ctx, runID); err != nil {
		return err
	}
	if _, err := r.HealInconsistentStepOrder(ctx, runID); err != nil {
		return err
	}
	return nil
}
