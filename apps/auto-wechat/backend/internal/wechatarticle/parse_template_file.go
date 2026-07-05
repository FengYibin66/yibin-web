package wechatarticle

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// LayoutTemplateFileMeta holds metadata from a few-shot HTML template file.
type LayoutTemplateFileMeta struct {
	Name         string
	Description  string
	Tags         []string
	HasSVG       bool
	ItemCountMin int
	ItemCountMax int
	BodyHTML     string
}

var (
	templateMetaLinePattern = regexp.MustCompile(`^\s*([a-zA-Z]+):\s*(.*)$`)
)

// ParseLayoutTemplateFile reads a few-shot HTML file with TEMPLATE_META comments.
func ParseLayoutTemplateFile(path string) (LayoutTemplateFileMeta, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return LayoutTemplateFileMeta{}, fmt.Errorf("read template file: %w", err)
	}
	return ParseLayoutTemplateHTML(string(raw))
}

// ParseLayoutTemplateHTML parses TEMPLATE_META from HTML content and returns publishable bodyHtml.
func ParseLayoutTemplateHTML(raw string) (LayoutTemplateFileMeta, error) {
	meta := LayoutTemplateFileMeta{
		ItemCountMin: 5,
		ItemCountMax: 10,
		HasSVG:       strings.Contains(strings.ToLower(raw), "<svg"),
	}

	metaBlock, rest, ok := extractTemplateMetaBlock(raw)
	if ok {
		if err := parseTemplateMetaLines(metaBlock, &meta); err != nil {
			return LayoutTemplateFileMeta{}, err
		}
		meta.BodyHTML = ExtractTemplateBodyHTML(rest)
	} else {
		meta.BodyHTML = ExtractTemplateBodyHTML(raw)
	}

	meta.BodyHTML = strings.TrimSpace(meta.BodyHTML)
	if meta.BodyHTML == "" {
		return LayoutTemplateFileMeta{}, fmt.Errorf("template bodyHtml is empty")
	}
	if meta.Name == "" {
		return LayoutTemplateFileMeta{}, fmt.Errorf("template meta missing name")
	}
	if err := ValidateGeneratedHTML(meta.BodyHTML); err != nil {
		return LayoutTemplateFileMeta{}, fmt.Errorf("invalid template html: %w", err)
	}
	if meta.HasSVG || ContainsSVG(meta.BodyHTML) {
		meta.HasSVG = true
	}
	return meta, nil
}

func extractTemplateMetaBlock(raw string) (metaBlock, rest string, ok bool) {
	lower := strings.ToLower(raw)
	idx := strings.Index(lower, "template_meta:")
	if idx < 0 {
		return "", raw, false
	}
	start := strings.LastIndex(raw[:idx], "<!--")
	if start < 0 {
		return "", raw, false
	}
	end := strings.Index(raw[start:], "-->")
	if end < 0 {
		return "", raw, false
	}
	end += start + 3
	metaBlock = raw[start:end]
	rest = strings.TrimSpace(raw[end:])
	return metaBlock, rest, true
}

func parseTemplateMetaLines(metaBlock string, meta *LayoutTemplateFileMeta) error {
	inMeta := false
	for _, line := range strings.Split(metaBlock, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.Contains(trimmed, "TEMPLATE_META:") {
			inMeta = true
			continue
		}
		if !inMeta {
			continue
		}
		if trimmed == "" || strings.HasPrefix(trimmed, "IMAGE_SLOTS") || strings.HasPrefix(trimmed, "SECTIONS") {
			continue
		}
		matches := templateMetaLinePattern.FindStringSubmatch(trimmed)
		if len(matches) != 3 {
			continue
		}
		key := strings.ToLower(matches[1])
		value := strings.TrimSpace(matches[2])
		switch key {
		case "name":
			meta.Name = value
		case "description":
			meta.Description = value
		case "tags":
			meta.Tags = parseTagsList(value)
		case "hassvg":
			meta.HasSVG = parseBool(value)
		case "itemcountmin":
			n, err := strconv.Atoi(value)
			if err != nil {
				return fmt.Errorf("invalid itemCountMin: %q", value)
			}
			meta.ItemCountMin = n
		case "itemcountmax":
			n, err := strconv.Atoi(value)
			if err != nil {
				return fmt.Errorf("invalid itemCountMax: %q", value)
			}
			meta.ItemCountMax = n
		}
	}
	return nil
}

func parseTagsList(raw string) []string {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "[") || !strings.HasSuffix(raw, "]") {
		return nil
	}
	inner := strings.TrimSpace(raw[1 : len(raw)-1])
	if inner == "" {
		return nil
	}
	parts := strings.Split(inner, ",")
	tags := make([]string, 0, len(parts))
	for _, part := range parts {
		tag := strings.TrimSpace(part)
		if tag != "" {
			tags = append(tags, tag)
		}
	}
	return tags
}

func parseBool(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}

// ExtractTemplateBodyHTML strips leading HTML comments and returns publishable bodyHtml.
func ExtractTemplateBodyHTML(raw string) string {
	trimmed := strings.TrimSpace(raw)
	for strings.HasPrefix(trimmed, "<!--") {
		end := strings.Index(trimmed, "-->")
		if end < 0 {
			break
		}
		trimmed = strings.TrimSpace(trimmed[end+3:])
	}
	return trimmed
}
