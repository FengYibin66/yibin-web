package application

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

var ErrReadSourcePresetMinRemaining = errors.New("至少保留一条阅读原文链接")

type ReadSourcePresetService struct {
	repo *mysql.ReadSourcePresetRepository
}

func NewReadSourcePresetService(repo *mysql.ReadSourcePresetRepository) *ReadSourcePresetService {
	return &ReadSourcePresetService{repo: repo}
}

func (s *ReadSourcePresetService) List(ctx context.Context) ([]domain.ReadSourcePreset, error) {
	return s.repo.List(ctx)
}

func (s *ReadSourcePresetService) Create(ctx context.Context, input domain.CreateReadSourcePresetInput) (domain.ReadSourcePreset, error) {
	label := strings.TrimSpace(input.Label)
	link := strings.TrimSpace(input.URL)
	if link == "" {
		return domain.ReadSourcePreset{}, fmt.Errorf("url is required")
	}
	if label == "" {
		label = link
	}
	parsed, err := url.Parse(link)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return domain.ReadSourcePreset{}, fmt.Errorf("invalid url")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return domain.ReadSourcePreset{}, fmt.Errorf("url must use http or https")
	}
	return s.repo.Create(ctx, domain.CreateReadSourcePresetInput{Label: label, URL: link})
}

func (s *ReadSourcePresetService) FirstPresetURL(ctx context.Context) (string, error) {
	preset, err := s.repo.First(ctx)
	if err != nil {
		return "", err
	}
	return preset.URL, nil
}

func (s *ReadSourcePresetService) URLForPresetID(ctx context.Context, presetID string) (string, error) {
	if strings.TrimSpace(presetID) == "" {
		return "", nil
	}
	preset, err := s.repo.GetByID(ctx, presetID)
	if err != nil {
		return "", err
	}
	return preset.URL, nil
}

func (s *ReadSourcePresetService) Delete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return fmt.Errorf("id is required")
	}
	count, err := s.repo.Count(ctx)
	if err != nil {
		return err
	}
	if count <= 1 {
		return ErrReadSourcePresetMinRemaining
	}
	return s.repo.Delete(ctx, id)
}
