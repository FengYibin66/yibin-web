package wechatarticle

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
)

var (
	imgSrcPattern       = regexp.MustCompile(`(?i)<img[^>]+src=["']([^"']+)["']`)
	svgImageURLPattern  = regexp.MustCompile(`(?i)<image\b[^>]*?\shref=["']([^"']+)["']`)
)

type ContentImageUploader interface {
	UploadContentImage(ctx context.Context, filename string, imageData []byte) (string, error)
}

type ImageFetcher interface {
	FetchFirst(ctx context.Context, urls ...string) ([]byte, string, error)
}

func ReplaceBodyImagesForWeChat(
	ctx context.Context,
	bodyHTML string,
	fetcher ImageFetcher,
	uploader ContentImageUploader,
) (string, error) {
	if strings.TrimSpace(bodyHTML) == "" {
		return bodyHTML, nil
	}
	if uploader == nil || fetcher == nil {
		return bodyHTML, nil
	}

	matches := imgSrcPattern.FindAllStringSubmatch(bodyHTML, -1)
	svgMatches := svgImageURLPattern.FindAllStringSubmatch(bodyHTML, -1)
	if len(matches) == 0 && len(svgMatches) == 0 {
		return bodyHTML, nil
	}

	result := bodyHTML
	seen := make(map[string]string)
	replaceURL := func(src string) (string, error) {
		src = strings.TrimSpace(src)
		if src == "" || strings.HasPrefix(src, "data:") {
			return src, nil
		}
		if strings.Contains(src, "mmbiz.qpic.cn") {
			return src, nil
		}
		if cdnURL, ok := seen[src]; ok {
			return cdnURL, nil
		}
		data, filename, err := fetcher.FetchFirst(ctx, src)
		if err != nil {
			return "", err
		}
		prepared, _, _, _, prepErr := media.PrepareIllustrationImage(data, filename)
		if prepErr != nil {
			return "", fmt.Errorf("prepare content image %s: %w", src, prepErr)
		}
		uploaded, err := uploader.UploadContentImage(ctx, "content.jpg", prepared)
		if err != nil {
			return "", fmt.Errorf("upload content image %s: %w", src, err)
		}
		seen[src] = uploaded
		return uploaded, nil
	}

	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		src := strings.TrimSpace(match[1])
		cdnURL, err := replaceURL(src)
		if err != nil {
			continue
		}
		if cdnURL != "" && cdnURL != src {
			result = strings.ReplaceAll(result, src, cdnURL)
		}
	}
	for _, match := range svgMatches {
		if len(match) < 2 {
			continue
		}
		src := strings.TrimSpace(match[1])
		cdnURL, err := replaceURL(src)
		if err != nil {
			continue
		}
		if cdnURL != "" && cdnURL != src {
			result = strings.ReplaceAll(result, src, cdnURL)
		}
	}
	return result, nil
}
