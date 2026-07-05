package wechatarticle

import (
	"testing"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func TestResolveContentSourceURL_userSelectedWins(t *testing.T) {
	refs := []domain.SourceRef{{Name: "A", URL: "https://example.com/a"}}
	got := ResolveContentSourceURL(
		"https://api.example.com/",
		"https://fengyibin66.github.io/",
		"run-1",
		refs,
		"https://user-picked.example/",
	)
	if got != "https://user-picked.example/" {
		t.Fatalf("got %q", got)
	}
}

func TestResolveContentSourceURL_publicPage(t *testing.T) {
	refs := []domain.SourceRef{{Name: "A", URL: "https://example.com/a"}}
	got := ResolveContentSourceURL("https://api.example.com/", "https://fengyibin66.github.io/", "run-1", refs, "")
	want := "https://api.example.com/api/v1/public/runs/run-1/sources"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestResolveContentSourceURL_readSourceDefault(t *testing.T) {
	refs := []domain.SourceRef{{Name: "A", URL: "https://openai.com/index/x"}}
	got := ResolveContentSourceURL("", "https://fengyibin66.github.io/", "run-1", refs, "")
	if got != "https://fengyibin66.github.io/" {
		t.Fatalf("got %q", got)
	}
}

func TestResolveContentSourceURL_firstSourceWhenReadSourceEmpty(t *testing.T) {
	refs := []domain.SourceRef{{Name: "A", URL: "https://openai.com/index/x"}}
	got := ResolveContentSourceURL("", "", "run-1", refs, "")
	if got != "https://openai.com/index/x" {
		t.Fatalf("got %q", got)
	}
}
