package domain

import "time"

type RunStatus string

const (
	RunStatusQueued    RunStatus = "queued"
	RunStatusRunning   RunStatus = "running"
	RunStatusSucceeded RunStatus = "succeeded"
	RunStatusFailed    RunStatus = "failed"
)

type StepStatus string

const (
	StepStatusPending   StepStatus = "pending"
	StepStatusRunning   StepStatus = "running"
	StepStatusSucceeded StepStatus = "succeeded"
	StepStatusFailed    StepStatus = "failed"
	StepStatusSkipped   StepStatus = "skipped"
)

type PipelineStep string

const (
	StepCollect    PipelineStep = "collect"
	StepRank       PipelineStep = "rank"
	StepEnrich     PipelineStep = "enrich"
	StepEditor     PipelineStep = "editor"
	StepWriter     PipelineStep = "writer"
	StepIllustrate PipelineStep = "illustrate"
	StepLayout     PipelineStep = "layout"
	StepReview     PipelineStep = "review"
	StepCover      PipelineStep = "cover"
	StepPublish    PipelineStep = "publish"
)

var DefaultPipelineSteps = []PipelineStep{
	StepCollect,
	StepRank,
	StepEnrich,
	StepEditor,
	StepWriter,
	StepIllustrate,
	StepLayout,
	StepReview,
	StepCover,
	StepPublish,
}

type PipelineRun struct {
	ID               string
	Status           RunStatus
	PublishMode      string
	LayoutTemplateID *string
	ErrorMessage     *string
	DraftMediaID     *string
	PreviewHTML      *string
	StartedAt        *time.Time
	FinishedAt       *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
	Steps            []PipelineRunStep
}

type PipelineRunStep struct {
	Step         PipelineStep
	Status       StepStatus
	ErrorMessage *string
	StartedAt    *time.Time
	FinishedAt   *time.Time
}

type CreateRunInput struct {
	PublishMode      string
	TriggeredBy      string
	LayoutTemplateID *string
}
