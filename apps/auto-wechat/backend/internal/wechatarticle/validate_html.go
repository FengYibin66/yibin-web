package wechatarticle

import (
	"fmt"
	"html"
	"regexp"
	"strings"
)

var (
	forbiddenHTMLPattern = regexp.MustCompile(`(?i)<\s*(script|iframe|style|link|meta|form|input|button|video|audio)\b`)
	idAttrPattern        = regexp.MustCompile(`(?i)\sid\s*=\s*['"]`)
)

// ValidateGeneratedHTML checks LLM/template HTML against WeChat layout constraints.
func ValidateGeneratedHTML(html string) error {
	trimmed := strings.TrimSpace(html)
	if trimmed == "" {
		return fmt.Errorf("empty bodyHtml")
	}
	if len(trimmed) > 120000 {
		return fmt.Errorf("bodyHtml too long: %d chars", len(trimmed))
	}
	lower := strings.ToLower(trimmed)
	for _, forbidden := range []string{"<script", "<iframe", "<style", "<form"} {
		if strings.Contains(lower, forbidden) {
			return fmt.Errorf("forbidden tag: %s", forbidden)
		}
	}
	if forbiddenHTMLPattern.MatchString(trimmed) {
		return fmt.Errorf("forbidden html element detected")
	}
	if idAttrPattern.MatchString(trimmed) {
		return fmt.Errorf("id attribute is not allowed in wechat html")
	}
	if !strings.Contains(lower, "<section") && !strings.Contains(lower, "<p") && !strings.Contains(lower, "<svg") {
		return fmt.Errorf("html must contain section, p, or svg content")
	}
	return nil
}

// ContainsSVG reports whether HTML includes inline svg interaction blocks.
func ContainsSVG(html string) bool {
	return strings.Contains(strings.ToLower(html), "<svg")
}

// ValidateIllustrationsInHTML ensures each ready illustration URL appears in bodyHtml
// (as <img src> or SVG <image href>). Skips when urls is empty.
func ValidateIllustrationsInHTML(bodyHTML string, urls []string) error {
	if len(urls) == 0 {
		return nil
	}
	trimmed := strings.TrimSpace(bodyHTML)
	if trimmed == "" {
		return fmt.Errorf("bodyHtml empty but %d illustration(s) expected", len(urls))
	}
	var missing []string
	for _, url := range urls {
		if url == "" {
			continue
		}
		if strings.Contains(trimmed, url) {
			continue
		}
		escaped := html.EscapeString(url)
		if escaped != url && strings.Contains(trimmed, escaped) {
			continue
		}
		missing = append(missing, url)
	}
	if len(missing) > 0 {
		if len(missing) == 1 {
			return fmt.Errorf("illustration URL missing from bodyHtml: %s", missing[0])
		}
		return fmt.Errorf("%d illustration URL(s) missing from bodyHtml (e.g. %s)", len(missing), missing[0])
	}
	return nil
}

// PreserveSVGStructure checks that output still has SMIL hooks when template had them.
func PreserveSVGStructure(templateHTML, outputHTML string) error {
	if !ContainsSVG(templateHTML) {
		return nil
	}
	if !ContainsSVG(outputHTML) {
		return fmt.Errorf("template has svg but output removed svg")
	}
	for _, token := range []string{"<animate", "begin=\"click", "<animateTransform"} {
		if strings.Contains(strings.ToLower(templateHTML), strings.ToLower(token)) {
			if !strings.Contains(strings.ToLower(outputHTML), strings.ToLower(token)) {
				return fmt.Errorf("svg interaction token lost: %s", token)
			}
		}
	}
	return nil
}
