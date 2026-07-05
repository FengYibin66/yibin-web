package wechatarticle

import (
	"fmt"
	"html"
	"strings"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

// CollectSourceRefs merges writer sources and digest items (deduped by URL).
func CollectSourceRefs(writer domain.WriterOutput, items []domain.RankedItem) []domain.SourceRef {
	seen := make(map[string]struct{})
	refs := make([]domain.SourceRef, 0)

	add := func(name, url string) {
		url = strings.TrimSpace(url)
		if url == "" {
			return
		}
		if _, ok := seen[url]; ok {
			return
		}
		seen[url] = struct{}{}
		if strings.TrimSpace(name) == "" {
			name = url
		}
		refs = append(refs, domain.SourceRef{Name: name, URL: url})
	}

	for _, source := range writer.Sources {
		add(source.Name, source.URL)
	}
	for _, item := range items {
		add(item.Title, item.URL)
	}

	return refs
}

// ResolveContentSourceURL picks 阅读原文 (content_source_url).
// Priority: userSelectedURL (per-run preset) → per-run sources page → env readSourceURL → first article URL.
func ResolveContentSourceURL(publicAPIBaseURL, readSourceURL, runID string, refs []domain.SourceRef, userSelectedURL string) string {
	if u := strings.TrimSpace(userSelectedURL); u != "" {
		return u
	}
	base := strings.TrimRight(strings.TrimSpace(publicAPIBaseURL), "/")
	if base != "" && strings.TrimSpace(runID) != "" {
		return fmt.Sprintf("%s/api/v1/public/runs/%s/sources", base, runID)
	}
	if u := strings.TrimSpace(readSourceURL); u != "" {
		return u
	}
	for _, ref := range refs {
		if strings.TrimSpace(ref.URL) != "" {
			return ref.URL
		}
	}
	return ""
}

// RenderSourcesPageHTML is the landing page linked from WeChat 阅读原文.
func RenderSourcesPageHTML(title string, refs []domain.SourceRef) string {
	if title == "" {
		title = "本期资讯来源"
	}
	var b strings.Builder
	b.WriteString("<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">")
	b.WriteString("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">")
	b.WriteString("<title>")
	b.WriteString(html.EscapeString(title))
	b.WriteString(" — 来源汇总</title>")
	b.WriteString(`<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:16px;background:#f5f5f5;color:#1a1a1a;}
main{max-width:640px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;}
h1{font-size:20px;line-height:1.4;margin:0 0 8px;}
p.meta{font-size:14px;color:#666;margin:0 0 16px;}
ol{padding-left:20px;margin:0;}
li{margin:0 0 14px;line-height:1.6;}
a{color:#576b95;word-break:break-all;}
.url{font-size:12px;color:#888;display:block;margin-top:4px;word-break:break-all;}
</style></head><body><main>`)
	b.WriteString("<h1>")
	b.WriteString(html.EscapeString(title))
	b.WriteString("</h1><p class=\"meta\">以下为本文引用资讯的原文链接，可在浏览器中打开。</p>")
	if len(refs) == 0 {
		b.WriteString("<p>暂无来源记录。</p>")
	} else {
		b.WriteString("<ol>")
		for _, ref := range refs {
			name := html.EscapeString(ref.Name)
			url := html.EscapeString(ref.URL)
			b.WriteString("<li><a href=\"")
			b.WriteString(url)
			b.WriteString("\" rel=\"noopener noreferrer\" target=\"_blank\">")
			b.WriteString(name)
			b.WriteString("</a><span class=\"url\">")
			b.WriteString(url)
			b.WriteString("</span></li>")
		}
		b.WriteString("</ol>")
	}
	b.WriteString("</main></body></html>")
	return b.String()
}
