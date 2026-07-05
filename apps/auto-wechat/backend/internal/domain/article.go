package domain

import "time"

type Article struct {
	ID             string
	SourceID       string
	Title          string
	URL            string
	SourceName     string
	SourceType     string
	SourceCategory string
	PublishedAt    *time.Time
	Summary        string
	Content        string
	ImageURL       string
	Language       string
	ContentHash    string
	Weight         float64
}

type CollectResult struct {
	Articles          []Article
	SourceTotal       int
	SourceSuccess     int
	SourceFailed      []string
	FilteredByRecency int
	FilteredByKeyword int
}
