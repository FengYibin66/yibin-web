package media

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func TestFitImageWithinMaxBytes_compressesOversizedJPEG(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 1280, 720))
	for y := 0; y < 720; y++ {
		for x := 0; x < 1280; x++ {
			src.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, src, &jpeg.Options{Quality: 100}); err != nil {
		t.Fatalf("encode: %v", err)
	}

	out, w, h, err := FitImageWithinMaxBytes(raw.Bytes(), MaxImageBytes)
	if err != nil {
		t.Fatalf("fit: %v", err)
	}
	if len(out) > MaxImageBytes {
		t.Fatalf("expected <= %d bytes, got %d", MaxImageBytes, len(out))
	}
	if w <= 0 || h <= 0 {
		t.Fatalf("expected dimensions, got %dx%d", w, h)
	}
}

func TestPrepareWeChatThumb_convertsPNG(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 900, 383))
	for y := 0; y < 383; y++ {
		for x := 0; x < 900; x++ {
			src.Set(x, y, color.RGBA{R: 20, G: 40, B: 200, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, src); err != nil {
		t.Fatalf("encode png: %v", err)
	}

	out, filename, err := PrepareWeChatThumb(buf.Bytes())
	if err != nil {
		t.Fatalf("prepare thumb: %v", err)
	}
	if filename != "cover.jpg" {
		t.Fatalf("expected cover.jpg, got %s", filename)
	}
	if !isJPEG(out) {
		t.Fatalf("expected jpeg output")
	}
	if len(out) > MaxWeChatThumbBytes {
		t.Fatalf("expected <= %d bytes, got %d", MaxWeChatThumbBytes, len(out))
	}
}
