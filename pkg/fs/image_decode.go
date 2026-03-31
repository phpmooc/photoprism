package fs

import (
	"image"
	"io"
	"os"
)

// openImageSection opens a file and returns a bounded reader spanning its current size.
func openImageSection(fileName string) (file *os.File, reader *io.SectionReader, err error) {
	file, err = os.Open(fileName) //nolint:gosec // fileName is supplied by the caller and may point to user media
	if err != nil {
		return nil, nil, err
	}

	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, nil, err
	}

	return file, io.NewSectionReader(file, 0, info.Size()), nil
}

// DecodeImageFile opens and decodes an image using a reader bounded to the file size.
func DecodeImageFile(fileName string) (_ image.Image, _ string, err error) {
	file, reader, err := openImageSection(fileName)
	if err != nil {
		return nil, "", err
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}()

	return image.Decode(reader)
}

// DecodeImageConfigFile opens an image and decodes only its config using a bounded reader.
func DecodeImageConfigFile(fileName string) (_ image.Config, _ string, err error) {
	file, reader, err := openImageSection(fileName)
	if err != nil {
		return image.Config{}, "", err
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}()

	return image.DecodeConfig(reader)
}
