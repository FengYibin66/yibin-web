package media

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

const MaxImageBytes = 1 << 20

type Store struct {
	dir           string
	publicBaseURL string
}

func NewStore(dir, publicBaseURL string) (*Store, error) {
	if strings.TrimSpace(dir) == "" {
		dir = "/app/media"
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create media dir: %w", err)
	}
	base := strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
	return &Store{dir: dir, publicBaseURL: base}, nil
}

func (s *Store) Dir() string {
	return s.dir
}

func (s *Store) PublicURL(assetID string) string {
	if s.publicBaseURL == "" {
		return fmt.Sprintf("/api/v1/public/media/%s", assetID)
	}
	return fmt.Sprintf("%s/api/v1/public/media/%s", s.publicBaseURL, assetID)
}

func (s *Store) SaveNew(data []byte, mimeType string) (id string, filePath string, err error) {
	if len(data) == 0 {
		return "", "", fmt.Errorf("empty image data")
	}
	if len(data) > MaxImageBytes {
		return "", "", fmt.Errorf("image exceeds %d bytes", MaxImageBytes)
	}

	ext, err := extForMime(mimeType)
	if err != nil {
		return "", "", err
	}

	id = uuid.NewString()
	filename := id + ext
	filePath = filepath.Join(s.dir, filename)
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return "", "", fmt.Errorf("write media file: %w", err)
	}
	return id, filePath, nil
}

func (s *Store) Read(assetID string) ([]byte, string, error) {
	matches, err := filepath.Glob(filepath.Join(s.dir, assetID+".*"))
	if err != nil {
		return nil, "", err
	}
	if len(matches) == 0 {
		return nil, "", fmt.Errorf("media not found: %s", assetID)
	}
	data, err := os.ReadFile(matches[0])
	if err != nil {
		return nil, "", err
	}
	mime := mimeForExt(filepath.Ext(matches[0]))
	return data, mime, nil
}

func extForMime(mimeType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/jpeg", "image/jpg":
		return ".jpg", nil
	case "image/png":
		return ".png", nil
	default:
		return "", fmt.Errorf("unsupported mime type: %s", mimeType)
	}
}

func mimeForExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".png":
		return "image/png"
	default:
		return "image/jpeg"
	}
}
