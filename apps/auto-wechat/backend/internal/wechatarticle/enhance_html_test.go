package wechatarticle

import (
	"strings"
	"testing"
)

func TestEnhanceBodyHTML_appendsPlainURL(t *testing.T) {
	in := `<p>text<a href='https://example.com/a' style='color:#576b95;'>[来源]</a></p>`
	out := EnhanceBodyHTML(in)
	if !strings.Contains(out, "https://example.com/a</span>") {
		t.Fatalf("expected plain url span, got %s", out)
	}
	if strings.Count(out, "https://example.com/a") < 2 {
		t.Fatalf("expected href in anchor and span, got %s", out)
	}
}

func TestEnhanceBodyHTML_idempotent(t *testing.T) {
	in := `<a href="https://x.com">[来源]</a>`
	once := EnhanceBodyHTML(in)
	twice := EnhanceBodyHTML(once)
	if once != twice {
		t.Fatalf("expected idempotent enhance")
	}
}
