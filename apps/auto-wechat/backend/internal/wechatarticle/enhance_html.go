package wechatarticle

import (
	"fmt"
	"html"
	"regexp"
	"strings"
)

const plainURLMarkerClass = "wechat-plain-source-url"

var anchorTagRE = regexp.MustCompile(`<a\s+href=(?:'([^']+)'|"([^"]+)")([^>]*)>([^<]*)</a>`)

// EnhanceBodyHTML appends visible plaintext URLs after each anchor for WeChat readers (long-press copy).
func EnhanceBodyHTML(bodyHTML string) string {
	if strings.TrimSpace(bodyHTML) == "" {
		return bodyHTML
	}

	return anchorTagRE.ReplaceAllStringFunc(bodyHTML, func(anchor string) string {
		parts := anchorTagRE.FindStringSubmatch(anchor)
		if len(parts) < 5 {
			return anchor
		}
		href := strings.TrimSpace(parts[1])
		if href == "" {
			href = strings.TrimSpace(parts[2])
		}
		if href == "" || !strings.HasPrefix(strings.ToLower(href), "http") {
			return anchor
		}

		plain := fmt.Sprintf(
			`<span class="%s" style="font-size:12px;color:#888;word-break:break-all;display:block;margin-top:4px;">%s</span>`,
			plainURLMarkerClass,
			html.EscapeString(href),
		)
		if strings.Contains(bodyHTML, anchor+plain) {
			return anchor
		}
		return anchor + plain
	})
}
