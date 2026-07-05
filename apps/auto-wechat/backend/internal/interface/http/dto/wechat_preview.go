package dto

import "github.com/auto-wechat-tech/backend/internal/application"

type CreateWeChatPreviewRequest struct {
	Title              string `json:"title"`
	BodyHTML           string `json:"bodyHtml"`
	RunID              string `json:"runId"`
	LayoutTemplateID   string `json:"layoutTemplateId"`
}

type WeChatPreviewSessionResponse struct {
	Token      string `json:"token"`
	PreviewURL string `json:"previewUrl"`
	ExpiresIn  int    `json:"expiresIn"`
	LocalOnly  bool   `json:"localOnly"`
	LocalHint  string `json:"localHint,omitempty"`
}

func ToWeChatPreviewSessionResponse(session application.WeChatPreviewSession) WeChatPreviewSessionResponse {
	return WeChatPreviewSessionResponse{
		Token:      session.Token,
		PreviewURL: session.PreviewURL,
		ExpiresIn:  session.ExpiresIn,
		LocalOnly:  session.LocalOnly,
		LocalHint:  session.LocalHint,
	}
}
