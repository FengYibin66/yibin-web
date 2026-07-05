package wechatarticle

import (
	_ "embed"
	"encoding/json"
	"sync"
)

//go:embed theme.json
var themeJSON []byte

// Theme holds design tokens for WeChat article rendering.
type Theme struct {
	SeriesTitle string `json:"seriesTitle"`
	Typography  struct {
		FontFamily       string `json:"fontFamily"`
		BodySize         string `json:"bodySize"`
		BodyLineHeight   string `json:"bodyLineHeight"`
		LeadSize         string `json:"leadSize"`
		LeadLineHeight   string `json:"leadLineHeight"`
		SectionSize      string `json:"sectionSize"`
		MetaSize         string `json:"metaSize"`
		MastheadSize     string `json:"mastheadSize"`
	} `json:"typography"`
	Colors struct {
		TextPrimary       string `json:"textPrimary"`
		TextSecondary     string `json:"textSecondary"`
		TextMuted         string `json:"textMuted"`
		Link              string `json:"link"`
		SurfaceLead       string `json:"surfaceLead"`
		SurfaceCard       string `json:"surfaceCard"`
		BorderSubtle      string `json:"borderSubtle"`
		Divider           string `json:"divider"`
		MastheadBg        string `json:"mastheadBg"`
		MastheadText      string `json:"mastheadText"`
		HeroGradientStart string `json:"heroGradientStart"`
		HeroGradientEnd   string `json:"heroGradientEnd"`
	} `json:"colors"`
	Spacing struct {
		PagePadding string `json:"pagePadding"`
		SectionGap  string `json:"sectionGap"`
		ItemGap     string `json:"itemGap"`
		LeadPadding string `json:"leadPadding"`
		BlockRadius string `json:"blockRadius"`
	} `json:"spacing"`
	TagAccents map[string]string `json:"tagAccents"`
}

var (
	defaultTheme     Theme
	defaultThemeOnce sync.Once
	defaultThemeErr  error
)

// DefaultTheme returns the embedded theme.json tokens.
func DefaultTheme() (Theme, error) {
	defaultThemeOnce.Do(func() {
		defaultThemeErr = json.Unmarshal(themeJSON, &defaultTheme)
	})
	return defaultTheme, defaultThemeErr
}

func (t Theme) accentForTag(tag string) string {
	if tag == "" {
		return t.Colors.HeroGradientEnd
	}
	if color, ok := t.TagAccents[tag]; ok && color != "" {
		return color
	}
	if color, ok := t.TagAccents["其他动态"]; ok {
		return color
	}
	return t.Colors.HeroGradientEnd
}
