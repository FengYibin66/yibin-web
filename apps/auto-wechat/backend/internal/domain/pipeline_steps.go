package domain

// StepIndex returns the position of a step in the default pipeline (0-based).
func StepIndex(step PipelineStep) int {
	for i, s := range DefaultPipelineSteps {
		if s == step {
			return i
		}
	}
	return -1
}

// StepsFrom returns the target step and all downstream steps in pipeline order.
func StepsFrom(from PipelineStep) []PipelineStep {
	idx := StepIndex(from)
	if idx < 0 {
		return nil
	}
	return append([]PipelineStep(nil), DefaultPipelineSteps[idx:]...)
}

// IsStepAtOrBefore returns true if step is at or before boundary in pipeline order.
func IsStepAtOrBefore(step, boundary PipelineStep) bool {
	return StepIndex(step) <= StepIndex(boundary)
}

// IsStepAtOrAfter returns true if step is at or after boundary in pipeline order.
func IsStepAtOrAfter(step, boundary PipelineStep) bool {
	return StepIndex(step) >= StepIndex(boundary)
}
