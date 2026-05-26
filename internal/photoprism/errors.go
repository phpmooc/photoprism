package photoprism

import "errors"

// ErrCanceled signals that a walk callback or worker was interrupted by Cancel().
var ErrCanceled = errors.New("canceled")

// ErrInsufficientStorage signals that a walk callback aborted because the storage
// path is critically low on free disk space or the configured quota is exhausted.
var ErrInsufficientStorage = errors.New("insufficient storage")
