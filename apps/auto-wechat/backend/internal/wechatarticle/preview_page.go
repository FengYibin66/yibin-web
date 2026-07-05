package wechatarticle

import (
	"html"
	"strings"
)

// RenderWeChatArticlePreviewHTML wraps body HTML for mobile WeChat in-app WebView.
// bodyHTML is trusted admin content (not escaped).
func RenderWeChatArticlePreviewHTML(title, bodyHTML string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		title = "图文预览"
	}
	bodyHTML = strings.TrimSpace(bodyHTML)

	var b strings.Builder
	b.WriteString("<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">")
	b.WriteString("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no\">")
	b.WriteString("<meta name=\"format-detection\" content=\"telephone=no\">")
	b.WriteString("<title>")
	b.WriteString(html.EscapeString(title))
	b.WriteString("</title>")
	b.WriteString(`<style>
html{-webkit-text-size-adjust:100%;}
body{margin:0;padding:16px 16px 40px;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:17px;line-height:1.6;color:#333;background:#fff;-webkit-tap-highlight-color:transparent;}
.rich_media_title{font-size:22px;line-height:1.4;font-weight:700;margin:0 0 12px;word-break:break-word;}
.rich_media_content{overflow:hidden;word-break:break-word;}
.rich_media_content img,.rich_media_content svg{max-width:100%!important;height:auto!important;}
.rich_media_content a{color:#576b95;text-decoration:none;}
.preview-banner{margin:0 0 16px;padding:10px 12px;border-radius:8px;background:#f0f9ff;color:#0369a1;font-size:13px;line-height:1.5;}
</style></head><body>`)
	b.WriteString(`<p class="preview-banner">微信扫码预览页 · 请在微信内打开以验收 SVG 交互。链接短时有效。</p>`)
	b.WriteString(`<h1 class="rich_media_title">`)
	b.WriteString(html.EscapeString(title))
	b.WriteString(`</h1><div class="rich_media_content">`)
	b.WriteString(bodyHTML)
	b.WriteString(`</div></body></html>`)
	return b.String()
}
