package http

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	goredis "github.com/redis/go-redis/v9"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/llmclient"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/interface/http/handler"
	"github.com/auto-wechat-tech/backend/internal/interface/http/middleware"
)

type Dependencies struct {
	Env                     string
	AdminAPIKey             string
	SessionCookieName       string
	CORSAllowedOrigins      []string
	AuthService             *application.AuthService
	DB                      *sql.DB
	Redis                   *goredis.Client
	LLMClient               *llmclient.Client
	PipelineService         *application.PipelineService
	ArtifactService         *application.ArtifactService
	ReadSourcePresetService *application.ReadSourcePresetService
	LayoutTemplateService   *application.LayoutTemplateService
	LayoutTemplateRepo      *mysql.LayoutTemplateRepository
	ImageAssetService       *application.ImageAssetService
	IllustrationService     *application.IllustrationService
	WeChatPreviewService    *application.WeChatPreviewService
	PipelineRepo            *mysql.PipelineRepository
	DigestRepo              *mysql.DigestRepository
	DraftRepo               *mysql.ContentDraftRepository
	SourceRepo              *mysql.SourceRepository
	AuthHandler             *handler.AuthHandler
}

func NewRouter(deps Dependencies) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery(), gin.Logger())
	router.Use(middleware.CORS(deps.CORSAllowedOrigins))

	healthHandler := handler.NewHealthHandler(deps.DB, deps.Redis, deps.LLMClient)
	pipelineHandler := handler.NewPipelineHandler(deps.PipelineService, deps.DigestRepo, deps.DraftRepo, deps.LayoutTemplateRepo)
	artifactHandler := handler.NewArtifactHandler(deps.ArtifactService)
	sourceHandler := handler.NewSourceHandler(deps.SourceRepo)
	readSourcePresetHandler := handler.NewReadSourcePresetHandler(deps.ReadSourcePresetService)
	layoutTemplateHandler := handler.NewLayoutTemplateHandler(deps.LayoutTemplateService, deps.DraftRepo)
	imageAssetHandler := handler.NewImageAssetHandler(deps.ImageAssetService)
	illustrationHandler := handler.NewIllustrationHandler(deps.IllustrationService)
	wechatPreviewHandler := handler.NewWeChatPreviewHandler(deps.WeChatPreviewService)
	sourcesPageHandler := handler.NewSourcesPageHandler(deps.PipelineRepo, deps.DigestRepo, deps.DraftRepo)

	authMiddleware := middleware.APIKeyOrSessionAuth(middleware.APIKeyOrSessionConfig{
		AdminAPIKey:       deps.AdminAPIKey,
		SessionCookieName: deps.SessionCookieName,
		AuthService:       deps.AuthService,
	})

	v1 := router.Group("/api/v1")
	{
		v1.GET("/health", healthHandler.Live)
		v1.GET("/health/ready", healthHandler.Ready)
		v1.GET("/public/runs/:id/sources", sourcesPageHandler.Render)
		v1.GET("/public/preview/wechat/:token", wechatPreviewHandler.Render)
		v1.GET("/public/media/:id", imageAssetHandler.ServePublic)

		v1.POST("/auth/login", middleware.LoginRateLimit(deps.Redis), deps.AuthHandler.Login)
		v1.POST("/auth/logout", deps.AuthHandler.Logout)

		authenticated := v1.Group("")
		authenticated.Use(authMiddleware)
		{
			authenticated.GET("/auth/me", deps.AuthHandler.Me)

			authenticated.POST("/pipeline/runs", pipelineHandler.CreateRun)
			authenticated.GET("/pipeline/runs", pipelineHandler.ListRuns)
			authenticated.GET("/pipeline/runs/:id", pipelineHandler.GetRun)
			authenticated.DELETE("/pipeline/runs/:id", pipelineHandler.DeleteRun)
			authenticated.PUT("/pipeline/runs/:id/layout-template", pipelineHandler.UpdateRunLayoutTemplate)
			authenticated.GET("/pipeline/runs/:id/artifacts", artifactHandler.GetArtifacts)
			authenticated.GET("/pipeline/runs/:id/steps/:step", artifactHandler.GetStep)
			authenticated.POST("/pipeline/runs/:id/steps/:step/regenerate", artifactHandler.RegenerateStep)
			authenticated.PUT("/pipeline/runs/:id/draft", artifactHandler.UpdateDraft)
			authenticated.PUT("/pipeline/runs/:id/digest", artifactHandler.UpdateDigest)
			authenticated.POST("/pipeline/runs/:id/publish", artifactHandler.PublishRun)
			authenticated.GET("/sources", sourceHandler.List)
			authenticated.GET("/read-source-presets", readSourcePresetHandler.List)
			authenticated.POST("/read-source-presets", readSourcePresetHandler.Create)
			authenticated.DELETE("/read-source-presets/:id", readSourcePresetHandler.Delete)
			authenticated.GET("/layout-templates", layoutTemplateHandler.List)
			authenticated.GET("/layout-templates/:id", layoutTemplateHandler.Get)
			authenticated.POST("/layout-templates", layoutTemplateHandler.Create)
			authenticated.PATCH("/layout-templates/:id/default", layoutTemplateHandler.SetDefault)
			authenticated.DELETE("/layout-templates/:id", layoutTemplateHandler.Delete)
			authenticated.POST("/pipeline/runs/:id/layout-templates", layoutTemplateHandler.SaveFromRun)
			authenticated.POST("/preview/wechat-sessions", wechatPreviewHandler.CreateSession)
			authenticated.GET("/image-assets", imageAssetHandler.List)
			authenticated.GET("/image-assets/:id", imageAssetHandler.Get)
			authenticated.DELETE("/image-assets/:id", imageAssetHandler.Delete)
			authenticated.POST("/media/upload", imageAssetHandler.Upload)
			authenticated.GET("/pipeline/runs/:id/illustrate", illustrationHandler.GetOutput)
			authenticated.POST("/pipeline/runs/:id/illustrate/slots/:slotId/regenerate", illustrationHandler.RegenerateSlot)
			authenticated.POST("/pipeline/runs/:id/illustrate/slots/:slotId/ingest", illustrationHandler.IngestSlot)
			authenticated.PATCH("/pipeline/runs/:id/illustrate/slots/:slotId", illustrationHandler.AssignLibraryAsset)
		}
	}

	return router
}
