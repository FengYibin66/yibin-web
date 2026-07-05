package wechatarticle

import (
	"strings"
	"testing"
)

func TestRenderWeChatArticlePreviewHTML_includesBody(t *testing.T) {
	body := `<section><svg><text>交互</text></svg></section>`
	html := RenderWeChatArticlePreviewHTML("测试标题", body)
	for _, want := range []string{"测试标题", body, "rich_media_content", "viewport"} {
		if !strings.Contains(html, want) {
			t.Fatalf("expected fragment %q in preview html", want)
		}
	}
}
