package media

import "strings"

// AbsolutePublicMediaURL resolves relative /api/v1/public/media paths against publicBaseURL.
// Absolute http(s) URLs are returned unchanged.
func AbsolutePublicMediaURL(publicBaseURL, raw string) string {
	u := strings.TrimSpace(raw)
	if u == "" {
		return u
	}
	lower := strings.ToLower(u)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return u
	}
	base := strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
	if strings.HasPrefix(u, "/") {
		if base == "" {
			return u
		}
		return base + u
	}
	if base == "" {
		return "/api/v1/public/media/" + u
	}
	return base + "/api/v1/public/media/" + u
}
