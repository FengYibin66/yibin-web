package domain

import (
	"encoding/json"
	"time"
)

type StepDetail struct {
	Step         PipelineStep
	Status       StepStatus
	InputJSON    json.RawMessage
	OutputJSON   json.RawMessage
	ErrorMessage *string
	DurationMs   *int
	StartedAt    *time.Time
	FinishedAt   *time.Time
}

type RunArtifacts struct {
	RunID         string
	RunStatus     RunStatus
	PublishMode   string
	Digest        *Digest
	ContentDraft  *ContentDraft
	Steps         []StepDetail
	DraftMediaID  *string
	PreviewHTML   *string
	PublishResult *PublishRecord
}

type PublishRecord struct {
	DraftMediaID string
	PublishMode  string
	CreatedAt    time.Time
}
