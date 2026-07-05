package application

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
)

const TemplateSampleTag = "template-sample"

// TemplateSampleManifest is consumed by few-shot/样例模板/_gen_cards.py.
type TemplateSampleManifest struct {
	CoverURLs []string `json:"coverUrls"`
}

var bundledTemplateSampleFilenames = []string{
	"01-main-white.png",
	"02-lifestyle.png",
	"03-model-front.png",
	"04-fabric-detail.png",
	"05-model-back.png",
	"06-ghost-mannequin.png",
}

// TemplateSampleCoverURLs returns ordered public media URLs from image_assets (ingests bundled PNGs if missing).
func (s *ImageAssetService) TemplateSampleCoverURLs(ctx context.Context, amazonDir string) ([]string, error) {
	if s == nil {
		return nil, fmt.Errorf("image asset service not configured")
	}
	assets, err := s.ensureTemplateSampleImages(ctx, resolveBundledAmazonDir(amazonDir))
	if err != nil {
		return nil, err
	}
	urls := make([]string, len(assets))
	for i, asset := range assets {
		if asset.URL == "" {
			return nil, fmt.Errorf("template sample %s has empty url", bundledTemplateSampleFilenames[i])
		}
		urls[i] = asset.URL
	}
	return urls, nil
}

// WriteTemplateSampleManifest persists cover URLs for _gen_cards.py.
func WriteTemplateSampleManifest(path string, urls []string) error {
	if len(urls) == 0 {
		return fmt.Errorf("no cover urls to write")
	}
	data, err := json.MarshalIndent(TemplateSampleManifest{CoverURLs: urls}, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (s *ImageAssetService) ensureTemplateSampleImages(ctx context.Context, amazonDir string) ([]domain.ImageAsset, error) {
	existing, err := s.listTemplateSampleAssets(ctx)
	if err != nil {
		return nil, err
	}
	byFilename := mapTemplateSamplesByFilename(existing)

	ordered := make([]domain.ImageAsset, 0, len(bundledTemplateSampleFilenames))
	for _, filename := range bundledTemplateSampleFilenames {
		if asset, ok := byFilename[filename]; ok {
			ordered = append(ordered, asset)
			continue
		}
		path := filepath.Join(amazonDir, filename)
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil, fmt.Errorf("read bundled sample %s: %w", path, readErr)
		}
		mimeType := "image/png"
		if len(data) > media.MaxImageBytes {
			fitted, fittedMime, w, h, fitErr := media.PrepareIllustrationImage(data, filename)
			if fitErr != nil {
				return nil, fmt.Errorf("prepare template sample %s: %w", filename, fitErr)
			}
			data = fitted
			mimeType = fittedMime
			_ = w
			_ = h
		}
		asset, _, ingestErr := s.Ingest(ctx, domain.IngestImageInput{
			Name:         "template-sample:" + filename,
			Source:       domain.ImageSourceUpload,
			OriginURL:    filename,
			Tags:         []string{TemplateSampleTag},
			AutoIngested: true,
			Data:         data,
			MimeType:     mimeType,
		})
		if ingestErr != nil {
			return nil, fmt.Errorf("ingest template sample %s: %w", filename, ingestErr)
		}
		ordered = append(ordered, asset)
	}
	return ordered, nil
}

func (s *ImageAssetService) listTemplateSampleAssets(ctx context.Context) ([]domain.ImageAsset, error) {
	items, err := s.List(ctx, domain.ListImageAssetsFilter{Limit: 100})
	if err != nil {
		return nil, err
	}
	filtered := make([]domain.ImageAsset, 0, len(bundledTemplateSampleFilenames))
	for _, item := range items {
		if hasTag(item.Tags, TemplateSampleTag) {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func mapTemplateSamplesByFilename(assets []domain.ImageAsset) map[string]domain.ImageAsset {
	out := make(map[string]domain.ImageAsset, len(assets))
	for _, asset := range assets {
		filename := templateSampleFilename(asset)
		if filename != "" {
			out[filename] = asset
		}
	}
	return out
}

func templateSampleFilename(asset domain.ImageAsset) string {
	name := strings.TrimSpace(asset.Name)
	if strings.HasPrefix(name, "template-sample:") {
		return strings.TrimPrefix(name, "template-sample:")
	}
	origin := strings.TrimSpace(asset.OriginURL)
	if origin != "" {
		return filepath.Base(origin)
	}
	return ""
}

func hasTag(tags []string, target string) bool {
	for _, tag := range tags {
		if tag == target {
			return true
		}
	}
	return false
}

func resolveBundledAmazonDir(preferred string) string {
	if preferred != "" {
		if st, err := os.Stat(preferred); err == nil && st.IsDir() {
			return preferred
		}
	}
	wd, _ := os.Getwd()
	for _, candidate := range []string{
		"few-shot/amazon-tshirt-main-images",
		"../few-shot/amazon-tshirt-main-images",
	} {
		path := candidate
		if !filepath.IsAbs(path) {
			path = filepath.Join(wd, candidate)
		}
		if st, err := os.Stat(path); err == nil && st.IsDir() {
			return path
		}
	}
	return filepath.Join(wd, "few-shot", "amazon-tshirt-main-images")
}
