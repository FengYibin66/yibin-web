package queue

const (
	TypePipelineExecute          = "pipeline:execute"
	TypePipelineStepRegenerate   = "pipeline:step_regenerate"
)

type PipelineExecutePayload struct {
	RunID string `json:"run_id"`
}

type PipelineStepRegeneratePayload struct {
	RunID string `json:"run_id"`
	Step  string `json:"step"`
}
