package cover

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/auto-wechat-tech/backend/internal/infrastructure/media"
)

const maxCoverBytes = 10 << 20

type Fetcher struct {
	client        *http.Client
	publicBaseURL string
}

func NewFetcher(publicBaseURL string) *Fetcher {
	return &Fetcher{
		client:        &http.Client{Timeout: 30 * time.Second},
		publicBaseURL: publicBaseURL,
	}
}

func (f *Fetcher) FetchFirst(ctx context.Context, urls ...string) ([]byte, string, error) {
	for _, rawURL := range urls {
		url := strings.TrimSpace(rawURL)
		if url == "" {
			continue
		}
		data, filename, err := f.fetchOne(ctx, url)
		if err == nil && len(data) > 0 {
			return data, filename, nil
		}
	}
	return nil, "", fmt.Errorf("no cover image available from %d urls", len(urls))
}

func (f *Fetcher) fetchOne(ctx context.Context, url string) ([]byte, string, error) {
	url = media.AbsolutePublicMediaURL(f.publicBaseURL, url)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("cover download status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxCoverBytes))
	if err != nil {
		return nil, "", err
	}

	filename := "cover.jpg"
	if ct := resp.Header.Get("Content-Type"); strings.Contains(ct, "png") {
		filename = "cover.png"
	}

	return data, filename, nil
}
