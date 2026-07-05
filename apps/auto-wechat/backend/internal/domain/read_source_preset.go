package domain

import "time"

type ReadSourcePreset struct {
	ID        string
	Label     string
	URL       string
	SortOrder int
	CreatedAt time.Time
}

type CreateReadSourcePresetInput struct {
	Label string
	URL   string
}

type PublishRunInput struct {
	ReadSourcePresetID *string
}
