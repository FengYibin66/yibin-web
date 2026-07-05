package textutil

import "strings"

// TruncateRunes limits s to at most maxRunes Unicode code points without splitting UTF-8.
func TruncateRunes(s string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	s = strings.ToValidUTF8(s, "")
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return string(runes[:maxRunes])
}
