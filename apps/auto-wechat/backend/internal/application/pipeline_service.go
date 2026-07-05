package application

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

type CreateRunCommand struct {
	PublishMode string
	TriggeredBy string
}

type RunEnqueuer interface {
	EnqueuePipelineExecute(ctx context.Context, runID string) error
	EnqueuePipelineStepRegenerate(ctx context.Context, runID, step string) error
	CancelRunTasks(ctx context.Context, runID string) error
}

type PipelineService struct {
	repo               *mysql.PipelineRepository
	layoutTemplateRepo *mysql.LayoutTemplateRepository
	enqueuer           RunEnqueuer
}

func NewPipelineService(
	repo *mysql.PipelineRepository,
	layoutTemplateRepo *mysql.LayoutTemplateRepository,
	enqueuer RunEnqueuer,
) *PipelineService {
	return &PipelineService{
		repo:               repo,
		layoutTemplateRepo: layoutTemplateRepo,
		enqueuer:           enqueuer,
	}
}

func (s *PipelineService) CreateRun(ctx context.Context, cmd CreateRunCommand) (domain.PipelineRun, error) {
	var layoutTemplateID *string
	if s.layoutTemplateRepo != nil {
		defaultID, err := s.layoutTemplateRepo.GetDefaultID(ctx, domain.LayoutArticleTypeDailyDigest)
		if err != nil {
			return domain.PipelineRun{}, fmt.Errorf("get default layout template: %w", err)
		}
		if defaultID != "" {
			layoutTemplateID = &defaultID
		}
	}

	run, err := s.repo.CreateRun(ctx, domain.CreateRunInput{
		PublishMode:      cmd.PublishMode,
		TriggeredBy:      cmd.TriggeredBy,
		LayoutTemplateID: layoutTemplateID,
	})
	if err != nil {
		return domain.PipelineRun{}, err
	}

	if err := s.enqueuer.EnqueuePipelineExecute(ctx, run.ID); err != nil {
		msg := err.Error()
		_ = s.repo.UpdateRunStatus(ctx, run.ID, domain.RunStatusFailed, &msg)
		return domain.PipelineRun{}, fmt.Errorf("enqueue pipeline: %w", err)
	}

	return run, nil
}

func (s *PipelineService) GetRun(ctx context.Context, id string) (domain.PipelineRun, error) {
	_ = s.repo.HealRunSteps(ctx, id)
	_ = s.reconcileRunStatus(ctx, id)
	return s.repo.GetRun(ctx, id)
}

func (s *PipelineService) reconcileRunStatus(ctx context.Context, runID string) error {
	steps, err := s.repo.ListStepDetails(ctx, runID)
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
		return s.repo.UpdateRunStatus(ctx, runID, domain.RunStatusRunning, nil)
	}
	if publishSucceeded {
		return s.repo.UpdateRunStatus(ctx, runID, domain.RunStatusSucceeded, nil)
	}
	if coverSucceeded && !hasFailed {
		return s.repo.UpdateRunStatus(ctx, runID, domain.RunStatusSucceeded, nil)
	}
	if hasFailed {
		if failMsg == nil {
			msg := "pipeline step failed"
			failMsg = &msg
		}
		return s.repo.UpdateRunStatus(ctx, runID, domain.RunStatusFailed, failMsg)
	}
	return nil
}

func (s *PipelineService) ListRuns(ctx context.Context, limit, offset int) ([]domain.PipelineRun, error) {
	return s.repo.ListRuns(ctx, limit, offset)
}

// DeleteRun stops queued/active worker tasks, clears the run lock, and deletes the run graph (CASCADE).
func (s *PipelineService) DeleteRun(ctx context.Context, runID string) error {
	if _, err := s.repo.GetRun(ctx, runID); err != nil {
		return err
	}

	if s.enqueuer != nil {
		if err := s.enqueuer.CancelRunTasks(ctx, runID); err != nil {
			return fmt.Errorf("cancel run tasks: %w", err)
		}
	}

	if err := s.repo.ClearActiveJob(ctx, runID); err != nil {
		return err
	}

	return s.repo.DeleteRun(ctx, runID)
}

func (s *PipelineService) MarkRunRunning(ctx context.Context, id string) error {
	return s.repo.UpdateRunStatus(ctx, id, domain.RunStatusRunning, nil)
}

func (s *PipelineService) MarkRunFailed(ctx context.Context, id string, message string) error {
	return s.repo.UpdateRunStatus(ctx, id, domain.RunStatusFailed, &message)
}

func (s *PipelineService) MarkRunSucceeded(ctx context.Context, id string) error {
	return s.repo.UpdateRunStatus(ctx, id, domain.RunStatusSucceeded, nil)
}

type UpdateRunLayoutTemplateCommand struct {
	LayoutTemplateID *string
	UseGlobalDefault bool
	ClearTemplate    bool
}

func (s *PipelineService) UpdateRunLayoutTemplate(ctx context.Context, runID string, cmd UpdateRunLayoutTemplateCommand) (domain.PipelineRun, error) {
	if _, err := s.repo.GetRun(ctx, runID); err != nil {
		return domain.PipelineRun{}, err
	}

	var templateID *string
	switch {
	case cmd.UseGlobalDefault:
		if s.layoutTemplateRepo == nil {
			return domain.PipelineRun{}, fmt.Errorf("layout template repo not configured")
		}
		defaultID, err := s.layoutTemplateRepo.GetDefaultID(ctx, domain.LayoutArticleTypeDailyDigest)
		if err != nil {
			return domain.PipelineRun{}, err
		}
		if defaultID != "" {
			templateID = &defaultID
		}
	case cmd.ClearTemplate:
		templateID = nil
	default:
		if cmd.LayoutTemplateID == nil || *cmd.LayoutTemplateID == "" {
			return domain.PipelineRun{}, fmt.Errorf("layoutTemplateId is required")
		}
		if s.layoutTemplateRepo != nil {
			if _, err := s.layoutTemplateRepo.GetByID(ctx, *cmd.LayoutTemplateID); err != nil {
				return domain.PipelineRun{}, err
			}
		}
		templateID = cmd.LayoutTemplateID
	}

	if err := s.repo.UpdateLayoutTemplateID(ctx, runID, templateID); err != nil {
		return domain.PipelineRun{}, err
	}
	return s.repo.GetRun(ctx, runID)
}

func (s *PipelineService) UpdateStepStatus(
	ctx context.Context,
	runID string,
	step domain.PipelineStep,
	status domain.StepStatus,
	errorMessage *string,
) error {
	return s.repo.UpdateStepStatus(ctx, runID, step, status, errorMessage)
}
