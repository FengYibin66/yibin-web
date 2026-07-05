package application

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"strings"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

type ImageAssetService struct {
	repo  *mysql.ImageAssetRepository
	store *media.Store
}

func NewImageAssetService(repo *mysql.ImageAssetRepository, store *media.Store) *ImageAssetService {
	return &ImageAssetService{repo: repo, store: store}
}

func (s *ImageAssetService) List(ctx context.Context, filter domain.ListImageAssetsFilter) ([]domain.ImageAsset, error) {
	return s.repo.List(ctx, filter)
}

func (s *ImageAssetService) GetByID(ctx context.Context, id string) (domain.ImageAsset, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ImageAssetService) Delete(ctx context.Context, id string) error {
	return s.repo.SoftDelete(ctx, id)
}

func (s *ImageAssetService) ReadFile(ctx context.Context, id string) ([]byte, string, error) {
	return s.store.Read(id)
}

func (s *ImageAssetService) Ingest(ctx context.Context, input domain.IngestImageInput) (domain.ImageAsset, bool, error) {
	if len(input.Data) == 0 {
		return domain.ImageAsset{}, false, fmt.Errorf("empty image data")
	}
	if len(input.Data) > media.MaxImageBytes {
		return domain.ImageAsset{}, false, fmt.Errorf("image exceeds %d bytes", media.MaxImageBytes)
	}

	mimeType := strings.ToLower(strings.TrimSpace(input.MimeType))
	if mimeType == "" {
		mimeType = "image/jpeg"
	}
	if mimeType != "image/jpeg" && mimeType != "image/png" {
		return domain.ImageAsset{}, false, fmt.Errorf("unsupported mime type: %s", mimeType)
	}

	hash := sha256.Sum256(input.Data)
	contentHash := hex.EncodeToString(hash[:])

	existing, err := s.repo.FindByContentHash(ctx, contentHash)
	if err == nil {
		_ = s.repo.IncrementUsage(ctx, existing.ID)
		existing.UsageCount++
		return existing, true, nil
	}
	if err != nil && err != mysql.ErrNotFound {
		return domain.ImageAsset{}, false, err
	}

	width, height := input.Width, input.Height
	if width <= 0 || height <= 0 {
		cfg, _, decodeErr := image.DecodeConfig(bytes.NewReader(input.Data))
		if decodeErr == nil {
			width = cfg.Width
			height = cfg.Height
		}
	}

	id, filePath, err := s.store.SaveNew(input.Data, mimeType)
	if err != nil {
		return domain.ImageAsset{}, false, err
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = "配图 " + id[:8]
	}

	asset := domain.ImageAsset{
		ID:           id,
		Name:         name,
		URL:          s.store.PublicURL(id),
		Storage:      domain.ImageStorageLocalVolume,
		Source:       input.Source,
		OriginURL:    input.OriginURL,
		Prompt:       input.Prompt,
		MimeType:     mimeType,
		ByteSize:     len(input.Data),
		Width:        width,
		Height:       height,
		ContentHash:  contentHash,
		Tags:         input.Tags,
		Provenance:   input.Provenance,
		FilePath:     filePath,
		UsageCount:   1,
		AutoIngested: input.AutoIngested,
	}

	created, err := s.repo.Create(ctx, asset)
	if err != nil {
		return domain.ImageAsset{}, false, err
	}
	return created, false, nil
}

func (s *ImageAssetService) PublicURL(assetID string) string {
	return s.store.PublicURL(assetID)
}

func (s *ImageAssetService) IncrementUsage(ctx context.Context, id string) error {
	return s.repo.IncrementUsage(ctx, id)
}

func (s *ImageAssetService) UploadAndIngest(
	ctx context.Context,
	name string,
	data []byte,
	mimeType string,
) (domain.ImageAsset, error) {
	asset, _, err := s.Ingest(ctx, domain.IngestImageInput{
		Name:         name,
		Source:       domain.ImageSourceUpload,
		AutoIngested: false,
		Data:         data,
		MimeType:     mimeType,
	})
	return asset, err
}
