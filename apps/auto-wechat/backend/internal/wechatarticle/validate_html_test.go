package wechatarticle

import (
	"strings"
	"testing"
)

func TestValidateGeneratedHTML_rejectsScript(t *testing.T) {
	err := ValidateGeneratedHTML(`<section><script>alert(1)</script></section>`)
	if err == nil {
		t.Fatal("expected error for script tag")
	}
}

func TestPreserveSVGStructure_requiresAnimate(t *testing.T) {
	template := `<svg><animate begin="click" dur="0.5s"></animate></svg>`
	output := `<svg><text>hi</text></svg>`
	err := PreserveSVGStructure(template, output)
	if err == nil {
		t.Fatal("expected svg structure preservation error")
	}
}

func TestPreserveSVGStructure_passesWhenIntact(t *testing.T) {
	html := `<section><svg><animate begin="click"></animate></svg></section>`
	if err := PreserveSVGStructure(html, html); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateGeneratedHTML_acceptsSection(t *testing.T) {
	html := strings.Repeat(`<section><p>正文</p></section>`, 1)
	if err := ValidateGeneratedHTML(html); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateIllustrationsInHTML_requiresURLs(t *testing.T) {
	url := "https://example.com/api/v1/public/media/abc"
	body := `<section><svg><image href="` + url + `"/></svg></section>`
	if err := ValidateIllustrationsInHTML(body, []string{url}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateIllustrationsInHTML_missingURL(t *testing.T) {
	err := ValidateIllustrationsInHTML(`<section><svg><rect/></svg></section>`, []string{"https://example.com/img.png"})
	if err == nil {
		t.Fatal("expected missing illustration error")
	}
}

func TestValidateIllustrationsInHTML_skipsEmpty(t *testing.T) {
	if err := ValidateIllustrationsInHTML("", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
