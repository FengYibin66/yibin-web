package application

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

var bundledLayoutTemplateFiles = []string{
	"daily-ai-tech-dark.html",
	"daily-ai-tech-light.html",
}

// SyncBundledLayoutTemplates:
//  1. ensure template-sample assets in image_assets
//  2. write few-shot/template-sample-urls.json
//  3. regenerate daily-ai-tech-*.html via _gen_cards.py
//  4. upsert layout_templates from those files
func (s *LayoutTemplateService) SyncBundledLayoutTemplates(ctx context.Context, fewShotDir string) error {
	if s.imageAssets == nil {
		return fmt.Errorf("image asset service required (use WithSampleImages)")
	}

	amazonDir := s.sampleImagesDir
	if amazonDir == "" {
		amazonDir = filepath.Join(fewShotDir, "..", "amazon-tshirt-main-images")
	}

	coverURLs, err := s.imageAssets.TemplateSampleCoverURLs(ctx, amazonDir)
	if err != nil {
		return fmt.Errorf("template sample urls: %w", err)
	}

	manifestPath := filepath.Join(fewShotDir, "..", "template-sample-urls.json")
	if err := WriteTemplateSampleManifest(manifestPath, coverURLs); err != nil {
		return fmt.Errorf("write manifest: %w", err)
	}
	fmt.Printf("wrote template sample manifest: %s (%d urls)\n", manifestPath, len(coverURLs))

	if err := runGenCardsScript(fewShotDir); err != nil {
		return err
	}

	for _, filename := range bundledLayoutTemplateFiles {
		path := filepath.Join(fewShotDir, filename)
		if err := s.syncLayoutTemplateFile(ctx, path); err != nil {
			return fmt.Errorf("%s: %w", filename, err)
		}
	}
	return nil
}

func runGenCardsScript(fewShotDir string) error {
	script := filepath.Join(fewShotDir, "_gen_cards.py")
	if _, err := os.Stat(script); err != nil {
		return fmt.Errorf("stat _gen_cards.py: %w", err)
	}
	cmd := exec.Command("python3", script)
	cmd.Dir = fewShotDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("run _gen_cards.py: %w", err)
	}
	return nil
}

func (s *LayoutTemplateService) syncLayoutTemplateFile(ctx context.Context, path string) error {
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("stat template file: %w", err)
	}

	meta, err := wechatarticle.ParseLayoutTemplateFile(path)
	if err != nil {
		return err
	}

	existing, err := s.repo.GetByName(ctx, meta.Name)
	if err != nil {
		return fmt.Errorf("template %q not found in database: %w", meta.Name, err)
	}

	updated, err := s.repo.Update(ctx, existing.ID, domain.UpdateLayoutTemplateInput{
		Description:  meta.Description,
		Tags:         meta.Tags,
		BodyHTML:     meta.BodyHTML,
		HasSVG:       meta.HasSVG,
		ItemCountMin: meta.ItemCountMin,
		ItemCountMax: meta.ItemCountMax,
	})
	if err != nil {
		return err
	}

	fmt.Printf("updated layout template: %s (id=%s, body=%d chars)\n",
		updated.Name, updated.ID, len(updated.BodyHTML))
	return nil
}
