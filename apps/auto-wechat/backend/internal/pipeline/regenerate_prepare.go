package pipeline

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

// PrepareRegenerate resets the target step and downstream steps, and clears stale artifacts.
// Safe to call from API (before enqueue) and Worker (idempotent).
func (e *Engine) PrepareRegenerate(ctx context.Context, runID string, target domain.PipelineStep) error {
	if domain.StepIndex(target) < 0 {
		return fmt.Errorf("unsupported step: %s", target)
	}

	if _, err := e.pipelineRepo.HealStaleRunningSteps(ctx, runID); err != nil {
		return err
	}
	// API may have already called MarkStepsRegeneratingFrom before enqueue; do not
	// assertNoStepRunning here — that would reject the worker task immediately.
	if err := e.pipelineRepo.UpdateRunStatus(ctx, runID, domain.RunStatusRunning, nil); err != nil {
		return err
	}
	if err := e.pipelineRepo.ResetStepsFrom(ctx, runID, target); err != nil {
		return err
	}
	if err := e.pipelineRepo.InvalidateDownstreamArtifacts(ctx, runID, target); err != nil {
		return err
	}
	if err := e.draftRepo.InvalidateDownstreamContent(ctx, runID, target); err != nil {
		return err
	}
	if domain.IsStepAtOrBefore(target, domain.StepEnrich) {
		if digest, err := e.digestRepo.GetByRunID(ctx, runID); err == nil {
			_, _ = e.digestRepo.UpdateItems(ctx, digest.ID, nil)
		}
	}

	return e.pipelineRepo.MarkStepsRegeneratingFrom(ctx, runID, target)
}
