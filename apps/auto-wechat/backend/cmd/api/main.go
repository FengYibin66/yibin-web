package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/config"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/cover"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/llmclient"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/queue"
	redisinfra "github.com/auto-wechat-tech/backend/internal/infrastructure/redis"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/wechat"
	httpserver "github.com/auto-wechat-tech/backend/internal/interface/http"
	"github.com/auto-wechat-tech/backend/internal/interface/http/handler"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	if cfg.Env != "development" {
		ginMode := os.Getenv("GIN_MODE")
		if ginMode == "" {
			_ = os.Setenv("GIN_MODE", "release")
		}
	}

	if err := mysql.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	ctx := context.Background()
	db, err := mysql.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}
	defer db.Close()

	redisClient, err := redisinfra.NewClient(cfg.RedisURL)
	if err != nil {
		log.Fatalf("connect redis: %v", err)
	}
	defer redisClient.Close()

	enqueuer, err := queue.NewEnqueuer(cfg.RedisURL)
	if err != nil {
		log.Fatalf("create enqueuer: %v", err)
	}
	defer enqueuer.Close()

	repo := mysql.NewPipelineRepository(db)
	sourceRepo := mysql.NewSourceRepository(db)
	digestRepo := mysql.NewDigestRepository(db)
	draftRepo := mysql.NewContentDraftRepository(db)
	readSourcePresetRepo := mysql.NewReadSourcePresetRepository(db)
	readSourcePresetService := application.NewReadSourcePresetService(readSourcePresetRepo)
	layoutTemplateRepo := mysql.NewLayoutTemplateRepository(db)
	layoutTemplateService := application.NewLayoutTemplateService(layoutTemplateRepo)
	llmClient := llmclient.NewClient(cfg.LLMServiceURL).WithTimeout(cfg.LLMInvokeTimeout)
	coverFetcher := cover.NewFetcher()
	imageAssetRepo := mysql.NewImageAssetRepository(db)
	mediaStore, err := media.NewStore(cfg.MediaDir, cfg.PublicAPIBaseURL)
	if err != nil {
		log.Fatalf("media store: %v", err)
	}
	imageAssetService := application.NewImageAssetService(imageAssetRepo, mediaStore)
	illustrationRegenerator := application.NewIllustrationRegenerator(repo, llmClient, coverFetcher, imageAssetService)
	illustrationService := application.NewIllustrationService(repo, imageAssetService, coverFetcher, illustrationRegenerator)
	if err := layoutTemplateService.EnsureSeedTemplates(ctx); err != nil {
		log.Printf("warn: seed layout templates: %v", err)
	}
	wechatPreviewStore := redisinfra.NewWeChatPreviewStore(redisClient, cfg.WeChatPreviewTTL)
	wechatPreviewService := application.NewWeChatPreviewService(
		wechatPreviewStore,
		draftRepo,
		layoutTemplateRepo,
		cfg.PublicAPIBaseURL,
	)
	pipelineService := application.NewPipelineService(repo, layoutTemplateRepo, enqueuer)
	wechatClient := wechat.NewClient(wechat.Config{
		AppID:     cfg.WeChatAppID,
		AppSecret: cfg.WeChatAppSecret,
	}, redisClient)
	artifactService := application.NewArtifactService(
		repo,
		digestRepo,
		draftRepo,
		wechatClient,
		coverFetcher,
		enqueuer,
		cfg.PublicAPIBaseURL,
		cfg.WeChatReadSourceURL,
		readSourcePresetService,
	)

	adminUserRepo := mysql.NewAdminUserRepository(db)
	if err := application.WarnIfNoAdminUsers(ctx, adminUserRepo); err != nil {
		log.Fatalf("check admin users: %v", err)
	}

	sessionStore := redisinfra.NewSessionStore(redisClient, cfg.SessionTTL)
	authService := application.NewAuthService(adminUserRepo, sessionStore)
	authHandler := handler.NewAuthHandler(
		authService,
		cfg.SessionCookieName,
		int(cfg.SessionTTL.Seconds()),
		cfg.SessionSecure,
		cfg.SessionSameSite,
	)

	router := httpserver.NewRouter(httpserver.Dependencies{
		Env:                     cfg.Env,
		AdminAPIKey:             cfg.AdminAPIKey,
		SessionCookieName:       cfg.SessionCookieName,
		CORSAllowedOrigins:      cfg.CORSAllowedOrigins,
		AuthService:             authService,
		AuthHandler:             authHandler,
		DB:                      db,
		Redis:                   redisClient,
		LLMClient:               llmClient,
		PipelineService:         pipelineService,
		ArtifactService:         artifactService,
		ReadSourcePresetService: readSourcePresetService,
		LayoutTemplateService:   layoutTemplateService,
		LayoutTemplateRepo:      layoutTemplateRepo,
		ImageAssetService:       imageAssetService,
		IllustrationService:     illustrationService,
		WeChatPreviewService:    wechatPreviewService,
		PipelineRepo:            repo,
		DigestRepo:              digestRepo,
		DraftRepo:               draftRepo,
		SourceRepo:              sourceRepo,
	})

	addr := fmt.Sprintf(":%d", cfg.APIPort)
	server := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("api listening on %s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
