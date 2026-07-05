package main

import (
	"context"
	"flag"
	"log"
	"os"
	"path/filepath"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/config"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

func main() {
	fewShotDir := flag.String("dir", "", "directory containing daily-ai-tech-*.html (default: ../few-shot/样例模板 from repo root)")
	sampleImagesDir := flag.String("sample-images", "", "amazon-tshirt-main-images directory (default: sibling of few-shot dir)")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	dir := *fewShotDir
	if dir == "" {
		wd, err := os.Getwd()
		if err != nil {
			log.Fatalf("getwd: %v", err)
		}
		dir = filepath.Join(wd, "..", "few-shot", "样例模板")
		if _, err := os.Stat(dir); err != nil {
			dir = filepath.Join(wd, "few-shot", "样例模板")
		}
	}

	ctx := context.Background()
	db, err := mysql.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}
	defer db.Close()

	mediaStore, err := media.NewStore(cfg.MediaDir, cfg.PublicAPIBaseURL)
	if err != nil {
		log.Fatalf("media store: %v", err)
	}
	imageAssets := application.NewImageAssetService(mysql.NewImageAssetRepository(db), mediaStore)

	svc := application.NewLayoutTemplateService(mysql.NewLayoutTemplateRepository(db)).
		WithSampleImages(imageAssets, *sampleImagesDir)

	if err := svc.SyncBundledLayoutTemplates(ctx, dir); err != nil {
		log.Fatalf("sync layout templates: %v", err)
	}
	log.Printf("synced bundled layout templates from %s", dir)
}
