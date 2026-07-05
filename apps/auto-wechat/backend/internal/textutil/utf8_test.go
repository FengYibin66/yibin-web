package textutil

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestTruncateRunes_preservesValidUTF8ForChinese(t *testing.T) {
	s := strings.Repeat("中文摘要", 80)
	out := TruncateRunes(s, 100)
	if !utf8.ValidString(out) {
		t.Fatal("truncated string must remain valid UTF-8")
	}
	if len([]rune(out)) != 100 {
		t.Fatalf("expected 100 runes, got %d", len([]rune(out)))
	}
}

func TestTruncateRunes_byteSliceWouldBreakWithoutRuneTruncate(t *testing.T) {
	s := strings.Repeat("中", 250) // 750 bytes
	// Old bug: s[:500] often ends with incomplete UTF-8 (e.g. \xE4\xBA)
	broken := s[:500]
	if utf8.ValidString(broken) {
		t.Skip("this sample happens to align on rune boundary")
	}
	out := TruncateRunes(s, 500)
	if !utf8.ValidString(out) {
		t.Fatal("TruncateRunes must produce valid UTF-8")
	}
}
