package media

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"image/jpeg"

	_ "golang.org/x/image/webp"
)

const (
	// MaxWeChatThumbBytes is the WeChat permanent-material thumb limit (JPG only).
	MaxWeChatThumbBytes = 64 << 10
)

// FitImageWithinMaxBytes re-encodes images as JPEG and downscales if needed to meet WeChat limits.
func FitImageWithinMaxBytes(data []byte, maxBytes int) ([]byte, int, int, error) {
	if maxBytes <= 0 {
		maxBytes = MaxImageBytes
	}
	if len(data) <= maxBytes && isJPEG(data) {
		if cfg, _, err := image.DecodeConfig(bytes.NewReader(data)); err == nil {
			return data, cfg.Width, cfg.Height, nil
		}
	}
	return encodeImageAsJPEGWithinMax(data, maxBytes)
}

// PrepareWeChatThumb converts any supported image (JPEG/PNG/WebP) to JPG for draft/add thumb upload.
func PrepareWeChatThumb(data []byte) ([]byte, string, error) {
	jpegData, _, _, err := encodeImageAsJPEGWithinMax(data, MaxWeChatThumbBytes)
	if err != nil {
		return nil, "", err
	}
	return jpegData, "cover.jpg", nil
}

// PrepareIllustrationImage fits a fetched image for WeChat uploadimg (≤1MB, JPEG).
func PrepareIllustrationImage(data []byte, filename string) ([]byte, string, int, int, error) {
	_ = filename
	fitted, width, height, err := encodeImageAsJPEGWithinMax(data, MaxImageBytes)
	if err != nil {
		return nil, "", 0, 0, err
	}
	return fitted, "image/jpeg", width, height, nil
}

func encodeImageAsJPEGWithinMax(data []byte, maxBytes int) ([]byte, int, int, error) {
	if maxBytes <= 0 {
		maxBytes = MaxImageBytes
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, 0, 0, fmt.Errorf("decode image: %w", err)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	for scale := 1.0; scale >= 0.35; scale -= 0.15 {
		scaled := img
		if scale < 1.0 {
			scaled = resizeNearest(img, int(float64(width)*scale), int(float64(height)*scale))
		}
		for quality := 88; quality >= 45; quality -= 7 {
			var buf bytes.Buffer
			if err := jpeg.Encode(&buf, scaled, &jpeg.Options{Quality: quality}); err != nil {
				return nil, 0, 0, fmt.Errorf("encode jpeg: %w", err)
			}
			if buf.Len() <= maxBytes {
				b := scaled.Bounds()
				return buf.Bytes(), b.Dx(), b.Dy(), nil
			}
		}
	}

	return nil, 0, 0, fmt.Errorf("image still exceeds %d bytes after compress", maxBytes)
}

func isJPEG(data []byte) bool {
	return len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff
}

func resizeNearest(src image.Image, width, height int) image.Image {
	if width < 1 {
		width = 1
	}
	if height < 1 {
		height = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	sb := src.Bounds()
	for y := 0; y < height; y++ {
		sy := sb.Min.Y + y*sb.Dy()/height
		for x := 0; x < width; x++ {
			sx := sb.Min.X + x*sb.Dx()/width
			dst.Set(x, y, src.At(sx, sy))
		}
	}
	return dst
}
