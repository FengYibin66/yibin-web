package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/config"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/collect"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/cover"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/llmclient"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/queue"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/redis"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/wechat"
	"github.com/auto-wechat-tech/backend/internal/pipeline"
	pipelineWorker "github.com/auto-wechat-tech/backend/internal/worker/pipeline"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	ctx := context.Background()
	db, err := mysql.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}
	defer db.Close()

	pipelineRepo := mysql.NewPipelineRepository(db)
	sourceRepo := mysql.NewSourceRepository(db)
	articleRepo := mysql.NewArticleRepository(db)
	digestRepo := mysql.NewDigestRepository(db)
	draftRepo := mysql.NewContentDraftRepository(db)
	readSourcePresetRepo := mysql.NewReadSourcePresetRepository(db)
	layoutTemplateRepo := mysql.NewLayoutTemplateRepository(db)
	layoutTemplateService := application.NewLayoutTemplateService(layoutTemplateRepo)
	if err := layoutTemplateService.EnsureSeedTemplates(ctx); err != nil {
		log.Printf("warn: seed layout templates: %v", err)
	}

	redisClient, err := redis.NewClient(cfg.RedisURL)
	if err != nil {
		log.Fatalf("connect redis: %v", err)
	}
	defer redisClient.Close()

	llmClient := llmclient.NewClient(cfg.LLMServiceURL)
	imageAssetRepo := mysql.NewImageAssetRepository(db)
	mediaStore, err := media.NewStore(cfg.MediaDir, cfg.PublicAPIBaseURL)
	if err != nil {
		log.Fatalf("media store: %v", err)
	}
	imageAssetService := application.NewImageAssetService(imageAssetRepo, mediaStore)
	wechatClient := wechat.NewClient(wechat.Config{
		AppID:     cfg.WeChatAppID,
		AppSecret: cfg.WeChatAppSecret,
	}, redisClient)

	engine := pipeline.NewEngine(
		pipelineRepo,
		sourceRepo,
		articleRepo,
		digestRepo,
		draftRepo,
		collect.NewRegistry(collect.Options{
			Days:          cfg.CollectDays,
			MinArticles:   cfg.CollectMinArticles,
			KeywordFilter: true,
		}),
		llmClient,
		wechatClient,
		cover.NewFetcher(cfg.PublicAPIBaseURL),
		cfg.PublicAPIBaseURL,
		cfg.WeChatReadSourceURL,
		readSourcePresetRepo,
		layoutTemplateRepo,
		imageAssetService,
		cfg.LLMInvokeTimeout,
	)

	_ = application.NewPipelineService(pipelineRepo, layoutTemplateRepo, noopEnqueuer{})

	server, err := queue.NewServer(cfg.RedisURL)
	if err != nil {
		log.Fatalf("create asynq server: %v", err)
	}

	mux := queue.NewServeMux()
	executor := pipelineWorker.NewExecutor(engine)
	pipelineWorker.RegisterHandlers(mux, executor)

	go func() {
		log.Println("worker started (pipeline engine phase 3)")
		if err := server.Run(mux); err != nil {
			log.Fatalf("worker run: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	server.Shutdown()
}

type noopEnqueuer struct{}

func (noopEnqueuer) EnqueuePipelineExecute(context.Context, string) error {
	return nil
}

func (noopEnqueuer) EnqueuePipelineStepRegenerate(context.Context, string, string) error {
	return nil
}

func (noopEnqueuer) CancelRunTasks(context.Context, string) error {
	return nil
}
