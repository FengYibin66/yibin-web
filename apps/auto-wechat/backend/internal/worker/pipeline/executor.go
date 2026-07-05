package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/hibiken/asynq"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/queue"
	enginepkg "github.com/auto-wechat-tech/backend/internal/pipeline"
)

type Executor struct {
	engine *enginepkg.Engine
}

func NewExecutor(engine *enginepkg.Engine) *Executor {
	return &Executor{engine: engine}
}

func (e *Executor) HandlePipelineExecute(ctx context.Context, task *asynq.Task) error {
	var payload queue.PipelineExecutePayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	log.Printf("pipeline execute run_id=%s", payload.RunID)
	return e.engine.Run(ctx, payload.RunID)
}

func (e *Executor) HandlePipelineStepRegenerate(ctx context.Context, task *asynq.Task) error {
	var payload queue.PipelineStepRegeneratePayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	log.Printf("pipeline step regenerate run_id=%s step=%s", payload.RunID, payload.Step)
	return e.engine.RegenerateStep(ctx, payload.RunID, domain.PipelineStep(payload.Step))
}

func RegisterHandlers(mux *asynq.ServeMux, executor *Executor) {
	mux.HandleFunc(queue.TypePipelineExecute, executor.HandlePipelineExecute)
	mux.HandleFunc(queue.TypePipelineStepRegenerate, executor.HandlePipelineStepRegenerate)
}
