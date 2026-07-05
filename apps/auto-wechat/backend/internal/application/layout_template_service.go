package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

type LayoutTemplateService struct {
	repo            *mysql.LayoutTemplateRepository
	imageAssets     *ImageAssetService
	sampleImagesDir string
}

func NewLayoutTemplateService(repo *mysql.LayoutTemplateRepository) *LayoutTemplateService {
	return &LayoutTemplateService{repo: repo}
}

// WithSampleImages enables bundled-template sync to hydrate local image paths from image_assets.
func (s *LayoutTemplateService) WithSampleImages(imageAssets *ImageAssetService, sampleImagesDir string) *LayoutTemplateService {
	s.imageAssets = imageAssets
	s.sampleImagesDir = sampleImagesDir
	return s
}

func (s *LayoutTemplateService) List(ctx context.Context) ([]domain.LayoutTemplate, error) {
	return s.repo.List(ctx)
}

func (s *LayoutTemplateService) GetByID(ctx context.Context, id string) (domain.LayoutTemplate, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *LayoutTemplateService) Create(ctx context.Context, input domain.CreateLayoutTemplateInput) (domain.LayoutTemplate, error) {
	bodyHTML := strings.TrimSpace(input.BodyHTML)
	if bodyHTML == "" {
		return domain.LayoutTemplate{}, fmt.Errorf("bodyHtml is required")
	}
	if err := wechatarticle.ValidateGeneratedHTML(bodyHTML); err != nil {
		return domain.LayoutTemplate{}, fmt.Errorf("invalid template html: %w", err)
	}
	if input.HasSVG || wechatarticle.ContainsSVG(bodyHTML) {
		input.HasSVG = true
	}
	if input.Name == "" {
		return domain.LayoutTemplate{}, fmt.Errorf("name is required")
	}
	return s.repo.Create(ctx, input)
}

func (s *LayoutTemplateService) CreateFromRunDraft(
	ctx context.Context,
	name, description string,
	tags []string,
	bodyHTML, runID string,
) (domain.LayoutTemplate, error) {
	return s.Create(ctx, domain.CreateLayoutTemplateInput{
		Name:         name,
		Description:  description,
		ArticleType:  domain.LayoutArticleTypeDailyDigest,
		Tags:         tags,
		BodyHTML:     bodyHTML,
		ItemCountMin: 5,
		ItemCountMax: 10,
		QualityScore: 85,
		SourceRunID:  runID,
	})
}

func (s *LayoutTemplateService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *LayoutTemplateService) SetDefault(ctx context.Context, id string) (domain.LayoutTemplate, error) {
	tmpl, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.LayoutTemplate{}, err
	}
	if err := s.repo.SetDefault(ctx, id, tmpl.ArticleType); err != nil {
		return domain.LayoutTemplate{}, err
	}
	return s.repo.GetByID(ctx, id)
}

func (s *LayoutTemplateService) EnsureSeedTemplates(ctx context.Context) error {
	count, err := s.repo.Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	seeds, err := seedLayoutTemplateInputs()
	if err != nil {
		return err
	}
	for _, seed := range seeds {
		if _, err := s.repo.Create(ctx, seed); err != nil {
			return err
		}
	}
	return nil
}
