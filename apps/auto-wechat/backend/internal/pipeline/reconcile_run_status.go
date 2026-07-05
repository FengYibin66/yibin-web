package pipeline

import (
	"context"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (e *Engine) reconcileRunStatus(ctx context.Context, runID string) error {
	if _, err := e.pipelineRepo.HealStaleRunningSteps(ctx, runID); err != nil {
		return err
	}

	steps, err := e.pipelineRepo.ListStepDetails(ctx, runID)
	if err != nil {
		return err
	}

	hasRunning := false
	hasFailed := false
	publishSucceeded := false
	coverSucceeded := false
	var failMsg *string

	for _, step := range steps {
		switch step.Status {
		case domain.StepStatusRunning:
			hasRunning = true
		case domain.StepStatusFailed:
			hasFailed = true
			if step.ErrorMessage != nil && *step.ErrorMessage != "" {
				msg := *step.ErrorMessage
				failMsg = &msg
			}
		}
		if step.Step == domain.StepPublish && step.Status == domain.StepStatusSucceeded {
			publishSucceeded = true
		}
		if step.Step == domain.StepCover && step.Status == domain.StepStatusSucceeded {
			coverSucceeded = true
		}
	}

	if hasRunning {
		return e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusRunning, nil)
	}
	if publishSucceeded {
		return e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusSucceeded, nil)
	}
	if coverSucceeded && !hasFailed {
		return e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusSucceeded, nil)
	}
	if hasFailed {
		if failMsg == nil {
			msg := "pipeline step failed"
			failMsg = &msg
		}
		return e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusFailed, failMsg)
	}

	// Content done, publish still pending — leave run status unchanged (manual publish).
	return nil
}
