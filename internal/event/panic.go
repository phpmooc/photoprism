package event

import "runtime/debug"

// LogPanic logs a recovered panic value together with the current stack trace,
// so that crashes which would otherwise terminate the process without any output
// can be diagnosed from the regular log. It does not stop the process; the caller
// decides whether to exit.
func LogPanic(r any) {
	if r == nil || Log == nil {
		return
	}

	Log.Errorf("panic: %v", r)
	Log.Errorf("stack trace:\n%s", debug.Stack())
}

// Recover recovers from a panic in the calling goroutine, if any, and logs it
// with a stack trace via LogPanic. Use it as a deferred call so a crash in a
// background task is reported instead of silently terminating the process:
// defer event.Recover().
func Recover() {
	if r := recover(); r != nil {
		LogPanic(r)
	}
}

// Safe runs fn and recovers from any panic it raises, logging it via LogPanic.
// It lets long-running loops continue after a single iteration panics rather
// than taking down the whole process.
func Safe(fn func()) {
	defer Recover()
	fn()
}
