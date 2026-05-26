package photoprism

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestErrCanceled(t *testing.T) {
	assert.EqualError(t, ErrCanceled, "canceled")

	wrapped := fmt.Errorf("worker stopped: %w", ErrCanceled)
	assert.True(t, errors.Is(wrapped, ErrCanceled))
	assert.False(t, errors.Is(wrapped, ErrInsufficientStorage))
}

func TestErrInsufficientStorage(t *testing.T) {
	assert.EqualError(t, ErrInsufficientStorage, "insufficient storage")

	wrapped := fmt.Errorf("walk aborted: %w", ErrInsufficientStorage)
	assert.True(t, errors.Is(wrapped, ErrInsufficientStorage))
	assert.False(t, errors.Is(wrapped, ErrCanceled))
}
