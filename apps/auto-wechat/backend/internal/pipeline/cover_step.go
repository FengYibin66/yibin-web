package pipeline

import (
	"context"
	"fmt"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (e *Engine) runCover(
	ctx context.Context,
	runID string,
	layoutOut domain.LayoutOutput,
	writerOut domain.WriterOutput,
	editorOut domain.EditorOutput,
	items []domain.RankedItem,
	articles []domain.Article,
) (domain.CoverOutput, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepCover, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return domain.CoverOutput{}, err
	}

	candidates := collectCoverCandidateURLs(layoutOut, items, articles, writerOut)
	if url, source, ok := e.tryFetchCoverURL(ctx, candidates...); ok {
		out := domain.CoverOutput{CoverImageURL: url, Source: source}
		if err := e.finishStepSucceeded(ctx, runID, domain.StepCover, start, toOutputMap(out)); err != nil {
			return domain.CoverOutput{}, err
		}
		return out, nil
	}

	title := firstNonEmptyStr(layoutOut.Title, writerOut.Title)
	input := map[string]any{
		"title":   title,
		"summary": writerOut.Summary,
		"topic":   editorOut.Topic,
	}
	output, err := e.llmClient.Invoke(ctx, "cover", input)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepCover, start, err)
		return domain.CoverOutput{}, err
	}

	coverOut, err := parseCoverOutput(output)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepCover, start, err)
		return domain.CoverOutput{}, err
	}
	if coverOut.CoverImageURL == "" {
		err := fmt.Errorf("cover agent returned empty coverImageUrl")
		e.finishStepFailed(ctx, runID, domain.StepCover, start, err)
		return domain.CoverOutput{}, err
	}

	if _, _, err := e.coverFetcher.FetchFirst(ctx, coverOut.CoverImageURL); err != nil {
		e.finishStepFailed(ctx, runID, domain.StepCover, start, fmt.Errorf("generated cover not fetchable: %w", err))
		return domain.CoverOutput{}, err
	}

	if err := e.finishStepSucceeded(ctx, runID, domain.StepCover, start, toOutputMap(coverOut)); err != nil {
		return domain.CoverOutput{}, err
	}
	return coverOut, nil
}

func collectCoverCandidateURLs(
	layoutOut domain.LayoutOutput,
	items []domain.RankedItem,
	articles []domain.Article,
	writer domain.WriterOutput,
) []string {
	images := collectImageCandidates(domain.IllustrationOutput{}, items, articles)
	urls := make([]string, 0, len(images)+1)
	if layoutOut.CoverImageURL != "" {
		urls = append(urls, layoutOut.CoverImageURL)
	}
	for _, image := range images {
		if u := image["url"]; u != "" {
			urls = append(urls, u)
		}
	}
	return urls
}

func (e *Engine) tryFetchCoverURL(ctx context.Context, urls ...string) (string, string, bool) {
	for _, url := range urls {
		if url == "" {
			continue
		}
		if _, _, err := e.coverFetcher.FetchFirst(ctx, url); err == nil {
			return url, "rss", true
		}
	}
	return "", "", false
}

func parseCoverOutput(output map[string]any) (domain.CoverOutput, error) {
	url := stringField(output, "coverImageUrl")
	if url == "" {
		return domain.CoverOutput{}, fmt.Errorf("cover missing coverImageUrl")
	}
	source := stringField(output, "source")
	if source == "" {
		source = "generated"
	}
	return domain.CoverOutput{
		CoverImageURL: url,
		Source:        source,
		ImagePrompt:   stringField(output, "imagePrompt"),
	}, nil
}
