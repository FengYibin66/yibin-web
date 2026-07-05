package wechatarticle

import "testing"

func TestParseLayoutTemplateHTML_extractsMetaAndBody(t *testing.T) {
	raw := `<!-- title -->
<!--
  TEMPLATE_META:
  name: 每日AI科技必看·暗色
  description: 轨道刊头
  tags: [大模型, Agent]
  hasSvg: true
  itemCountMin: 5
  itemCountMax: 10
-->
<section><p>hello</p><svg></svg></section>`

	meta, err := ParseLayoutTemplateHTML(raw)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if meta.Name != "每日AI科技必看·暗色" {
		t.Fatalf("name = %q", meta.Name)
	}
	if meta.Description != "轨道刊头" {
		t.Fatalf("description = %q", meta.Description)
	}
	if len(meta.Tags) != 2 || meta.Tags[0] != "大模型" {
		t.Fatalf("tags = %#v", meta.Tags)
	}
	if !meta.HasSVG {
		t.Fatal("expected hasSvg")
	}
	if meta.ItemCountMin != 5 || meta.ItemCountMax != 10 {
		t.Fatalf("item counts = %d/%d", meta.ItemCountMin, meta.ItemCountMax)
	}
	if meta.BodyHTML != `<section><p>hello</p><svg></svg></section>` {
		t.Fatalf("body = %q", meta.BodyHTML)
	}
}
