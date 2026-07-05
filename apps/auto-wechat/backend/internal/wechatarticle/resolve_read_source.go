package wechatarticle

import (
	"context"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type ReadSourcePresetLookup interface {
	URLForPresetID(ctx context.Context, presetID string) (string, error)
	FirstPresetURL(ctx context.Context) (string, error)
}

type presetLookup struct {
	urlForID func(ctx context.Context, presetID string) (string, error)
	firstURL func(ctx context.Context) (string, error)
}

func NewReadSourcePresetLookup(
	urlForID func(ctx context.Context, presetID string) (string, error),
	firstURL func(ctx context.Context) (string, error),
) ReadSourcePresetLookup {
	return presetLookup{urlForID: urlForID, firstURL: firstURL}
}

func (p presetLookup) URLForPresetID(ctx context.Context, presetID string) (string, error) {
	return p.urlForID(ctx, presetID)
}

func (p presetLookup) FirstPresetURL(ctx context.Context) (string, error) {
	return p.firstURL(ctx)
}

// SelectedReadSourceURL resolves URL from per-run preset or first list item.
func SelectedReadSourceURL(ctx context.Context, lookup ReadSourcePresetLookup, draft domain.ContentDraft) string {
	if lookup == nil {
		return ""
	}
	if draft.ReadSourcePresetID != "" {
		if u, err := lookup.URLForPresetID(ctx, draft.ReadSourcePresetID); err == nil && u != "" {
			return u
		}
	}
	if u, err := lookup.FirstPresetURL(ctx); err == nil {
		return u
	}
	return ""
}
