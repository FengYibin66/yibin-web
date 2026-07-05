package mysql

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (r *PipelineRepository) UpdateStepOutput(
	ctx context.Context,
	runID string,
	step domain.PipelineStep,
	output map[string]any,
) error {
	outputJSON, err := json.Marshal(output)
	if err != nil {
		return err
	}
	const query = `
		UPDATE pipeline_run_steps
		SET output_json = ?,
		    status = 'succeeded',
		    error_message = NULL,
		    finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP(3))
		WHERE run_id = ? AND step = ?
	`
	res, err := r.db.ExecContext(ctx, query, outputJSON, runID, step)
	if err != nil {
		return fmt.Errorf("update step output: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
