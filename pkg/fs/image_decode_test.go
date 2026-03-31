package fs

import (
	"bytes"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDecodeImageConfigFile(t *testing.T) {
	t.Run("Png", func(t *testing.T) {
		fileName := filepath.Join(t.TempDir(), "pixel.png")
		buf := bytes.NewBuffer(nil)
		require.NoError(t, png.Encode(buf, image.NewNRGBA(image.Rect(0, 0, 1, 1))))
		require.NoError(t, os.WriteFile(fileName, buf.Bytes(), ModeFile))

		cfg, format, err := DecodeImageConfigFile(fileName)

		require.NoError(t, err)
		assert.Equal(t, "png", format)
		assert.Equal(t, 1, cfg.Width)
		assert.Equal(t, 1, cfg.Height)
	})
	t.Run("MalformedTiffIfdOffset", func(t *testing.T) {
		fileName := filepath.Join(t.TempDir(), "evil.tiff")
		payload := []byte{0x49, 0x49, 0x2a, 0x00, 0xff, 0xff, 0xff, 0xff}
		require.NoError(t, os.WriteFile(fileName, payload, ModeFile))

		_, _, err := DecodeImageConfigFile(fileName)

		require.Error(t, err)
	})
}

func TestDecodeImageFile(t *testing.T) {
	t.Run("Png", func(t *testing.T) {
		fileName := filepath.Join(t.TempDir(), "pixel.png")
		buf := bytes.NewBuffer(nil)
		require.NoError(t, png.Encode(buf, image.NewNRGBA(image.Rect(0, 0, 2, 3))))
		require.NoError(t, os.WriteFile(fileName, buf.Bytes(), ModeFile))

		img, format, err := DecodeImageFile(fileName)

		require.NoError(t, err)
		assert.Equal(t, "png", format)
		assert.Equal(t, 2, img.Bounds().Dx())
		assert.Equal(t, 3, img.Bounds().Dy())
	})
	t.Run("MalformedTiffIfdOffset", func(t *testing.T) {
		fileName := filepath.Join(t.TempDir(), "evil.tiff")
		payload := []byte{0x49, 0x49, 0x2a, 0x00, 0xff, 0xff, 0xff, 0xff}
		require.NoError(t, os.WriteFile(fileName, payload, ModeFile))

		_, _, err := DecodeImageFile(fileName)

		require.Error(t, err)
	})
}
