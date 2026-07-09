package config

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// DefaultWeChatReadSourceURL is the default 阅读原文 (content_source_url) when not overridden.
const DefaultWeChatReadSourceURL = "https://fengyibin66.github.io/"

type Config struct {
	Env                 string
	APIPort             int
	AdminAPIKey         string
	SessionCookieName   string
	SessionTTL          time.Duration
	SessionSecure       bool
	SessionSameSite     http.SameSite
	CORSAllowedOrigins  []string
	LogLevel            string
	DatabaseURL         string
	RedisURL            string
	LLMServiceURL       string
	LLMInvokeTimeout    time.Duration
	StubPipeline        bool
	WeChatAppID         string
	WeChatAppSecret     string
	PublicAPIBaseURL      string
	WeChatPreviewTTL      time.Duration
	WeChatReadSourceURL   string
	CollectDays         int
	CollectMinArticles  int
	MediaDir            string
}

func Load() (Config, error) {
	// Monorepo root env files (development / production); paths for CLI from backend/
	for _, path := range []string{
		".env.production",
		".env.development",
		"../.env.production",
		"../.env.development",
		"../../.env.production",
		"../../.env.development",
		".env",
	} {
		_ = godotenv.Load(path)
	}

	port, err := strconv.Atoi(getEnv("API_PORT", "8080"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid API_PORT: %w", err)
	}

	stubPipeline := getEnv("STUB_PIPELINE", "true") == "true"
	env := getEnv("ENV", "development")

	sessionTTL, err := time.ParseDuration(getEnv("SESSION_TTL", "24h"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid SESSION_TTL: %w", err)
	}

	sessionSecure := getEnv("SESSION_SECURE", "false") == "true"
	if env == "production" {
		sessionSecure = getEnv("SESSION_SECURE", "true") == "true"
	}

	collectDays, err := strconv.Atoi(getEnv("COLLECT_DAYS", "2"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid COLLECT_DAYS: %w", err)
	}
	collectMinArticles, err := strconv.Atoi(getEnv("COLLECT_MIN_ARTICLES", "5"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid COLLECT_MIN_ARTICLES: %w", err)
	}

	llmInvokeTimeout, err := time.ParseDuration(getEnv("LLM_INVOKE_TIMEOUT", "10m"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid LLM_INVOKE_TIMEOUT: %w", err)
	}

	wechatPreviewTTL, err := time.ParseDuration(getEnv("WECHAT_PREVIEW_TTL", "30m"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid WECHAT_PREVIEW_TTL: %w", err)
	}

	corsOrigins := parseCSV(getEnv("CORS_ALLOWED_ORIGINS", ""))
	if len(corsOrigins) == 0 && env == "development" {
		corsOrigins = []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		}
	}

	return Config{
		Env:                 env,
		APIPort:             port,
		AdminAPIKey:         getEnv("ADMIN_API_KEY", ""),
		SessionCookieName:   getEnv("SESSION_COOKIE_NAME", "session_id"),
		SessionTTL:          sessionTTL,
		SessionSecure:       sessionSecure,
		SessionSameSite:     parseSameSite(getEnv("SESSION_SAME_SITE", "Lax")),
		CORSAllowedOrigins:  corsOrigins,
		LogLevel:            getEnv("LOG_LEVEL", "info"),
		DatabaseURL:         getEnv("DATABASE_URL", ""),
		RedisURL:            getEnv("REDIS_URL", "redis://localhost:6379/0"),
		LLMServiceURL:       getEnv("LLM_SERVICE_URL", "http://localhost:8090"),
		LLMInvokeTimeout:    llmInvokeTimeout,
		StubPipeline:        stubPipeline,
		WeChatAppID:         getEnv("WECHAT_APP_ID", ""),
		WeChatAppSecret:     getEnv("WECHAT_APP_SECRET", ""),
		PublicAPIBaseURL:    getEnv("PUBLIC_API_BASE_URL", ""),
		WeChatPreviewTTL:    wechatPreviewTTL,
		WeChatReadSourceURL: getEnv("WECHAT_READ_SOURCE_URL", DefaultWeChatReadSourceURL),
		CollectDays:         collectDays,
		CollectMinArticles:  collectMinArticles,
		MediaDir:            getEnv("MEDIA_DIR", "/app/media"),
	}, nil
}

func (c Config) Validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.RedisURL == "" {
		return fmt.Errorf("REDIS_URL is required")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func parseSameSite(value string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
