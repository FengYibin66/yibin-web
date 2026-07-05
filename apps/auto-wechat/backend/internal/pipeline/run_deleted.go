package pipeline

import (
	"context"
	"log"

	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

func (e *Engine) runExists(ctx context.Context, runID string) bool {
	_, err := e.pipelineRepo.GetRun(ctx, runID)
	return err == nil
}

func (e *Engine) abortIfRunDeleted(ctx context.Context, runID string) bool {
	if e.runExists(ctx, runID) {
		return false
	}
	log.Printf("run_id=%s deleted, abort worker", runID)
	return true
}

func isRunNotFound(err error) bool {
	return err == mysql.ErrNotFound
}
