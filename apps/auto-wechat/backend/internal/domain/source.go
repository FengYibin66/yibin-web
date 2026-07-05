package domain

import (
	"encoding/json"
	"time"
)

type Source struct {
	ID        string
	Name      string
	Type      string
	Category  string
	URL       string
	Weight    float64
	Lang      string
	Config    json.RawMessage
	Enabled   bool
	CreatedAt time.Time
}
