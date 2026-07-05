package domain

import "time"

type ImageStorage string

const (
	ImageStorageLocalVolume ImageStorage = "local_volume"
	ImageStorageWeChatCDN   ImageStorage = "wechat_cdn"
	ImageStorageCOS         ImageStorage = "cos"
)

type ImageSource string

const (
	ImageSourceGenerated ImageSource = "generated"
	ImageSourceUpload    ImageSource = "upload"
	ImageSourceRSS       ImageSource = "rss"
	ImageSourceOG        ImageSource = "og"
	ImageSourceScraped   ImageSource = "scraped"
)

type ImageProvenance struct {
	FirstRunID  string `json:"firstRunId,omitempty"`
	FirstSlotID string `json:"firstSlotId,omitempty"`
	Headline    string `json:"headline,omitempty"`
}

type ImageAsset struct {
	ID            string
	Name          string
	URL           string
	Storage       ImageStorage
	Source        ImageSource
	OriginURL     string
	Prompt        string
	MimeType      string
	ByteSize      int
	Width         int
	Height        int
	ContentHash   string
	Tags          []string
	Provenance    ImageProvenance
	FilePath      string
	UsageCount    int
	AutoIngested  bool
	DeletedAt     *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type IngestImageInput struct {
	Name         string
	Source       ImageSource
	OriginURL    string
	Prompt       string
	Tags         []string
	Provenance   ImageProvenance
	AutoIngested bool
	Data         []byte
	MimeType     string
	Width        int
	Height       int
}

type ListImageAssetsFilter struct {
	Source  string
	Keyword string
	Limit   int
	Offset  int
}
