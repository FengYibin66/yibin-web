package pipeline

import (
	"context"
	"fmt"
)

func (e *Engine) withActiveJob(ctx context.Context, runID, job string, fn func(context.Context) error) error {
	if err := e.pipelineRepo.TryBeginActiveJob(ctx, runID, job); err != nil {
		return err
	}
	defer func() { _ = e.pipelineRepo.EndActiveJob(ctx, runID, job) }()

	if err := e.pipelineRepo.HealRunSteps(ctx, runID); err != nil {
		return err
	}
	if e.abortIfRunDeleted(ctx, runID) {
		return nil
	}
	return fn(ctx)
}

func runJobID(kind string, step string) string {
	if step == "" {
		return kind
	}
	return fmt.Sprintf("%s:%s", kind, step)
}
