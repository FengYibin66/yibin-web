package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	redisstore "github.com/auto-wechat-tech/backend/internal/infrastructure/redis"
)

type WeChatPreviewService struct {
	store                 *redisstore.WeChatPreviewStore
	draftRepo             *mysql.ContentDraftRepository
	layoutTemplateRepo    *mysql.LayoutTemplateRepository
	publicAPIBaseURL      string
	previewPath           string
}

func NewWeChatPreviewService(
	store *redisstore.WeChatPreviewStore,
	draftRepo *mysql.ContentDraftRepository,
	layoutTemplateRepo *mysql.LayoutTemplateRepository,
	publicAPIBaseURL string,
) *WeChatPreviewService {
	base := strings.TrimRight(strings.TrimSpace(publicAPIBaseURL), "/")
	return &WeChatPreviewService{
		store:              store,
		draftRepo:          draftRepo,
		layoutTemplateRepo: layoutTemplateRepo,
		publicAPIBaseURL:   base,
		previewPath:        "/api/v1/public/preview/wechat/",
	}
}

type CreateWeChatPreviewInput struct {
	Title              string
	BodyHTML           string
	RunID              string
	LayoutTemplateID   string
}

type WeChatPreviewSession struct {
	Token       string
	PreviewURL  string
	ExpiresIn   int
	LocalOnly   bool
	LocalHint   string
}

func (s *WeChatPreviewService) CreateSession(ctx context.Context, input CreateWeChatPreviewInput) (WeChatPreviewSession, error) {
	title, bodyHTML, err := s.resolveContent(ctx, input)
	if err != nil {
		return WeChatPreviewSession{}, err
	}
	if strings.TrimSpace(bodyHTML) == "" {
		return WeChatPreviewSession{}, fmt.Errorf("bodyHtml is empty")
	}

	token := uuid.NewString()
	if err := s.store.Save(ctx, token, redisstore.WeChatPreviewPayload{
		Title:    title,
		BodyHTML: bodyHTML,
	}); err != nil {
		return WeChatPreviewSession{}, err
	}

	previewURL, localOnly, localHint := s.buildPreviewURL(token)
	return WeChatPreviewSession{
		Token:      token,
		PreviewURL: previewURL,
		ExpiresIn:  int(s.store.TTL().Seconds()),
		LocalOnly:  localOnly,
		LocalHint:  localHint,
	}, nil
}

func (s *WeChatPreviewService) GetPayload(ctx context.Context, token string) (redisstore.WeChatPreviewPayload, error) {
	return s.store.Get(ctx, token)
}

func (s *WeChatPreviewService) resolveContent(ctx context.Context, input CreateWeChatPreviewInput) (string, string, error) {
	if id := strings.TrimSpace(input.LayoutTemplateID); id != "" {
		tpl, err := s.layoutTemplateRepo.GetByID(ctx, id)
		if err != nil {
			return "", "", err
		}
		title := input.Title
		if title == "" {
			title = tpl.Name
		}
		return title, tpl.BodyHTML, nil
	}

	if runID := strings.TrimSpace(input.RunID); runID != "" {
		draft, err := s.draftRepo.GetByRunID(ctx, runID)
		if err != nil {
			return "", "", err
		}
		title := input.Title
		if title == "" {
			title = draft.Title
		}
		body := strings.TrimSpace(input.BodyHTML)
		if body == "" {
			body = draft.BodyHTML
		}
		return title, body, nil
	}

	return strings.TrimSpace(input.Title), strings.TrimSpace(input.BodyHTML), nil
}

func (s *WeChatPreviewService) buildPreviewURL(token string) (url string, localOnly bool, hint string) {
	path := s.previewPath + token
	if s.publicAPIBaseURL != "" {
		return s.publicAPIBaseURL + path, false, ""
	}
	localOnly = true
	hint = "未配置 PUBLIC_API_BASE_URL，微信无法访问 localhost。请配置公网 API 地址（如 https://your-domain.com）或使用 ngrok 将 8080 暴露到公网后写入 .env。"
	return "http://localhost:8080" + path, localOnly, hint
}
