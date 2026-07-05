package pipeline

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
)

func fetchAndFitIllustrationImage(
	ctx context.Context,
	fetcher interface {
		FetchFirst(ctx context.Context, urls ...string) ([]byte, string, error)
	},
	imageURL string,
) ([]byte, string, int, int, error) {
	data, filename, err := fetcher.FetchFirst(ctx, imageURL)
	if err != nil {
		return nil, "", 0, 0, fmt.Errorf("fetch generated image: %w", err)
	}
	fitted, mimeType, width, height, prepErr := media.PrepareIllustrationImage(data, filename)
	if prepErr != nil {
		return nil, "", 0, 0, prepErr
	}
	return fitted, mimeType, width, height, nil
}
