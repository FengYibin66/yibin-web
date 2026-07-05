package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type PipelineRepository struct {
	db *sql.DB
}

func NewPipelineRepository(db *sql.DB) *PipelineRepository {
	return &PipelineRepository{db: db}
}

func (r *PipelineRepository) CreateRun(ctx context.Context, input domain.CreateRunInput) (domain.PipelineRun, error) {
	runID := uuid.NewString()
	publishMode := input.PublishMode
	if publishMode == "" {
		publishMode = "draft_only"
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.PipelineRun{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	const insertRun = `
		INSERT INTO pipeline_runs (id, status, publish_mode, triggered_by, layout_template_id)
		VALUES (?, ?, ?, ?, ?)
	`

	layoutTemplateID := sql.NullString{}
	if input.LayoutTemplateID != nil && *input.LayoutTemplateID != "" {
		layoutTemplateID = sql.NullString{String: *input.LayoutTemplateID, Valid: true}
	}

	if _, err := tx.ExecContext(ctx, insertRun, runID, domain.RunStatusQueued, publishMode, nullString(input.TriggeredBy), layoutTemplateID); err != nil {
		return domain.PipelineRun{}, fmt.Errorf("insert run: %w", err)
	}

	const insertStep = `
		INSERT INTO pipeline_run_steps (id, run_id, step, status)
		VALUES (?, ?, ?, ?)
	`

	for _, step := range domain.DefaultPipelineSteps {
		stepID := uuid.NewString()
		if _, err := tx.ExecContext(ctx, insertStep, stepID, runID, step, domain.StepStatusPending); err != nil {
			return domain.PipelineRun{}, fmt.Errorf("insert step %s: %w", step, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return domain.PipelineRun{}, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetRun(ctx, runID)
}

func (r *PipelineRepository) GetRun(ctx context.Context, id string) (domain.PipelineRun, error) {
	const query = `
		SELECT id, status, publish_mode, error_message, draft_media_id, preview_html,
		       layout_template_id, started_at, finished_at, created_at, updated_at
		FROM pipeline_runs
		WHERE id = ?
	`

	row := r.db.QueryRowContext(ctx, query, id)
	run, err := scanRun(row)
	if err != nil {
		if errorsIsNoRows(err) {
			return domain.PipelineRun{}, ErrNotFound
		}
		return domain.PipelineRun{}, fmt.Errorf("get run: %w", err)
	}

	steps, err := r.listSteps(ctx, id)
	if err != nil {
		return domain.PipelineRun{}, err
	}
	run.Steps = steps

	return run, nil
}

func (r *PipelineRepository) ListRuns(ctx context.Context, limit, offset int) ([]domain.PipelineRun, error) {
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	const query = `
		SELECT id, status, publish_mode, error_message, draft_media_id, preview_html,
		       layout_template_id, started_at, finished_at, created_at, updated_at
		FROM pipeline_runs
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list runs: %w", err)
	}
	defer rows.Close()

	runs := make([]domain.PipelineRun, 0)
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, fmt.Errorf("scan run: %w", err)
		}

		steps, err := r.listSteps(ctx, run.ID)
		if err != nil {
			return nil, err
		}
		run.Steps = steps
		runs = append(runs, run)
	}

	return runs, rows.Err()
}

func (r *PipelineRepository) UpdateRunStatus(
	ctx context.Context,
	id string,
	status domain.RunStatus,
	errorMessage *string,
) error {
	const query = `
		UPDATE pipeline_runs
		SET status = ?,
		    error_message = ?,
		    updated_at = CURRENT_TIMESTAMP(3),
		    started_at = CASE WHEN ? = 'running' AND started_at IS NULL THEN CURRENT_TIMESTAMP(3) ELSE started_at END,
		    finished_at = CASE WHEN ? IN ('succeeded', 'failed') THEN CURRENT_TIMESTAMP(3) ELSE finished_at END
		WHERE id = ?
	`

	_, err := r.db.ExecContext(ctx, query, status, errorMessage, status, status, id)
	if err != nil {
		return fmt.Errorf("update run status: %w", err)
	}
	return nil
}

func (r *PipelineRepository) UpdateStepStatus(
	ctx context.Context,
	runID string,
	step domain.PipelineStep,
	status domain.StepStatus,
	errorMessage *string,
) error {
	return r.FinishStep(ctx, runID, step, status, errorMessage, nil, nil)
}

func (r *PipelineRepository) FinishStep(
	ctx context.Context,
	runID string,
	step domain.PipelineStep,
	status domain.StepStatus,
	errorMessage *string,
	outputJSON []byte,
	durationMs *int,
) error {
	if status == domain.StepStatusRunning {
		const query = `
			UPDATE pipeline_run_steps
			SET status = ?,
			    error_message = NULL,
			    output_json = NULL,
			    duration_ms = NULL,
			    started_at = CURRENT_TIMESTAMP(3),
			    finished_at = NULL
			WHERE run_id = ? AND step = ?
		`
		_, err := r.db.ExecContext(ctx, query, status, runID, step)
		if err != nil {
			return fmt.Errorf("finish step: %w", err)
		}
		return nil
	}

	const query = `
		UPDATE pipeline_run_steps
		SET status = ?,
		    error_message = ?,
		    output_json = COALESCE(?, output_json),
		    duration_ms = COALESCE(?, duration_ms),
		    finished_at = CURRENT_TIMESTAMP(3)
		WHERE run_id = ? AND step = ?
	`

	_, err := r.db.ExecContext(ctx, query, status, errorMessage, outputJSON, durationMs, runID, step)
	if err != nil {
		return fmt.Errorf("finish step: %w", err)
	}
	return nil
}

func (r *PipelineRepository) SkipRemainingSteps(ctx context.Context, runID string, fromStep domain.PipelineStep) error {
	started := false
	for _, step := range domain.DefaultPipelineSteps {
		if step == fromStep {
			started = true
		}
		if !started {
			continue
		}
		if err := r.FinishStep(ctx, runID, step, domain.StepStatusSkipped, nil, nil, nil); err != nil {
			return err
		}
	}
	return nil
}

func (r *PipelineRepository) UpdateRunArtifacts(
	ctx context.Context,
	id string,
	draftMediaID *string,
	previewHTML *string,
) error {
	const query = `
		UPDATE pipeline_runs
		SET draft_media_id = COALESCE(?, draft_media_id),
		    preview_html = COALESCE(?, preview_html),
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
	`

	_, err := r.db.ExecContext(ctx, query, draftMediaID, previewHTML, id)
	if err != nil {
		return fmt.Errorf("update run artifacts: %w", err)
	}
	return nil
}

func (r *PipelineRepository) GetRunPublishMode(ctx context.Context, id string) (string, error) {
	const query = `SELECT publish_mode FROM pipeline_runs WHERE id = ?`
	var mode string
	if err := r.db.QueryRowContext(ctx, query, id).Scan(&mode); err != nil {
		return "", fmt.Errorf("get publish mode: %w", err)
	}
	return mode, nil
}

func (r *PipelineRepository) GetStepDetail(ctx context.Context, runID string, step domain.PipelineStep) (domain.StepDetail, error) {
	const query = `
		SELECT step, status, input_json, output_json, error_message, duration_ms, started_at, finished_at
		FROM pipeline_run_steps
		WHERE run_id = ? AND step = ?
	`

	var detail domain.StepDetail
	var stepName, status string
	var inputJSON, outputJSON []byte

	err := r.db.QueryRowContext(ctx, query, runID, step).Scan(
		&stepName,
		&status,
		&inputJSON,
		&outputJSON,
		&detail.ErrorMessage,
		&detail.DurationMs,
		&detail.StartedAt,
		&detail.FinishedAt,
	)
	if err != nil {
		if errorsIsNoRows(err) {
			return domain.StepDetail{}, ErrNotFound
		}
		return domain.StepDetail{}, fmt.Errorf("get step detail: %w", err)
	}

	detail.Step = domain.PipelineStep(stepName)
	detail.Status = domain.StepStatus(status)
	detail.InputJSON = inputJSON
	detail.OutputJSON = outputJSON
	return detail, nil
}

func (r *PipelineRepository) ListStepDetails(ctx context.Context, runID string) ([]domain.StepDetail, error) {
	query := fmt.Sprintf(`
		SELECT step, status, input_json, output_json, error_message, duration_ms, started_at, finished_at
		FROM pipeline_run_steps
		WHERE run_id = ?
		ORDER BY %s
	`, pipelineStepField)

	rows, err := r.db.QueryContext(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("list step details: %w", err)
	}
	defer rows.Close()

	details := make([]domain.StepDetail, 0)
	for rows.Next() {
		var detail domain.StepDetail
		var stepName, status string
		var inputJSON, outputJSON []byte

		if err := rows.Scan(
			&stepName,
			&status,
			&inputJSON,
			&outputJSON,
			&detail.ErrorMessage,
			&detail.DurationMs,
			&detail.StartedAt,
			&detail.FinishedAt,
		); err != nil {
			return nil, fmt.Errorf("scan step detail: %w", err)
		}

		detail.Step = domain.PipelineStep(stepName)
		detail.Status = domain.StepStatus(status)
		detail.InputJSON = inputJSON
		detail.OutputJSON = outputJSON
		details = append(details, detail)
	}

	return details, rows.Err()
}

func (r *PipelineRepository) MarkStepsSkipped(ctx context.Context, runID string, steps []domain.PipelineStep) error {
	for _, step := range steps {
		if err := r.FinishStep(ctx, runID, step, domain.StepStatusSkipped, nil, nil, nil); err != nil {
			return err
		}
	}
	return nil
}

func (r *PipelineRepository) listSteps(ctx context.Context, runID string) ([]domain.PipelineRunStep, error) {
	query := fmt.Sprintf(`
		SELECT step, status, error_message, started_at, finished_at
		FROM pipeline_run_steps
		WHERE run_id = ?
		ORDER BY %s
	`, pipelineStepField)

	rows, err := r.db.QueryContext(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("list steps: %w", err)
	}
	defer rows.Close()

	steps := make([]domain.PipelineRunStep, 0)
	for rows.Next() {
		var step domain.PipelineRunStep
		var stepName string
		var status string
		var errMsg *string
		var startedAt, finishedAt *time.Time

		if err := rows.Scan(&stepName, &status, &errMsg, &startedAt, &finishedAt); err != nil {
			return nil, fmt.Errorf("scan step: %w", err)
		}

		step.Step = domain.PipelineStep(stepName)
		step.Status = domain.StepStatus(status)
		step.ErrorMessage = errMsg
		step.StartedAt = startedAt
		step.FinishedAt = finishedAt
		steps = append(steps, step)
	}

	return steps, rows.Err()
}

type scannable interface {
	Scan(dest ...any) error
}

func (r *PipelineRepository) UpdateLayoutTemplateID(ctx context.Context, runID string, templateID *string) error {
	var value sql.NullString
	if templateID != nil && *templateID != "" {
		value = sql.NullString{String: *templateID, Valid: true}
	}
	const query = `
		UPDATE pipeline_runs
		SET layout_template_id = ?, updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
	`
	result, err := r.db.ExecContext(ctx, query, value, runID)
	if err != nil {
		return fmt.Errorf("update run layout template: %w", err)
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

func scanRun(row scannable) (domain.PipelineRun, error) {
	var run domain.PipelineRun
	var status string
	var errMsg, draftMediaID, previewHTML, layoutTemplateID *string
	var startedAt, finishedAt *time.Time

	err := row.Scan(
		&run.ID,
		&status,
		&run.PublishMode,
		&errMsg,
		&draftMediaID,
		&previewHTML,
		&layoutTemplateID,
		&startedAt,
		&finishedAt,
		&run.CreatedAt,
		&run.UpdatedAt,
	)
	if err != nil {
		return domain.PipelineRun{}, err
	}

	run.Status = domain.RunStatus(status)
	run.ErrorMessage = errMsg
	run.DraftMediaID = draftMediaID
	run.PreviewHTML = previewHTML
	run.LayoutTemplateID = layoutTemplateID
	run.StartedAt = startedAt
	run.FinishedAt = finishedAt

	return run, nil
}
