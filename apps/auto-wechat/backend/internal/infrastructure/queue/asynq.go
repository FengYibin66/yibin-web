package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/hibiken/asynq"
)

const defaultQueue = "default"

type Enqueuer struct {
	client    *asynq.Client
	inspector *asynq.Inspector
}

func NewEnqueuer(redisURL string) (*Enqueuer, error) {
	opts, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}

	return &Enqueuer{
		client:    asynq.NewClient(opts),
		inspector: asynq.NewInspector(opts),
	}, nil
}

// RunTaskID is the asynq task id shared by execute and regenerate for one run.
func RunTaskID(runID string) string {
	return fmt.Sprintf("pipeline:run:%s", runID)
}

func (e *Enqueuer) EnqueuePipelineExecute(ctx context.Context, runID string) error {
	payload, err := json.Marshal(PipelineExecutePayload{RunID: runID})
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	task := asynq.NewTask(TypePipelineExecute, payload, runTaskOptions(runID)...)
	if _, err := e.client.EnqueueContext(ctx, task); err != nil {
		return fmt.Errorf("enqueue pipeline execute: %w", err)
	}

	return nil
}

func (e *Enqueuer) EnqueuePipelineStepRegenerate(ctx context.Context, runID, step string) error {
	payload, err := json.Marshal(PipelineStepRegeneratePayload{RunID: runID, Step: step})
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	task := asynq.NewTask(TypePipelineStepRegenerate, payload, runTaskOptions(runID)...)
	if _, err := e.client.EnqueueContext(ctx, task); err != nil {
		return fmt.Errorf("enqueue step regenerate: %w", err)
	}

	return nil
}

func (e *Enqueuer) Close() error {
	if e.inspector != nil {
		_ = e.inspector.Close()
	}
	return e.client.Close()
}

// CancelRunTasks removes pending tasks and requests cancellation of in-flight work for a run.
func (e *Enqueuer) CancelRunTasks(ctx context.Context, runID string) error {
	if e.inspector == nil {
		return nil
	}
	_ = ctx

	taskID := RunTaskID(runID)
	if err := e.inspector.DeleteTask(defaultQueue, taskID); err != nil && !errors.Is(err, asynq.ErrTaskNotFound) {
		return fmt.Errorf("delete pending task: %w", err)
	}
	if err := e.inspector.CancelProcessing(taskID); err != nil && !errors.Is(err, asynq.ErrTaskNotFound) {
		return fmt.Errorf("cancel processing task: %w", err)
	}
	return nil
}

// One pending task per run id; mutex also enforced via DB active_job.
func runTaskOptions(runID string) []asynq.Option {
	return []asynq.Option{
		asynq.TaskID(RunTaskID(runID)),
		asynq.MaxRetry(0),
	}
}

func NewServer(redisURL string) (*asynq.Server, error) {
	opts, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}

	server := asynq.NewServer(opts, asynq.Config{
		Concurrency: 2,
		Queues: map[string]int{
			"default": 10,
		},
	})

	return server, nil
}

func NewServeMux() *asynq.ServeMux {
	return asynq.NewServeMux()
}
