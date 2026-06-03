package event

import (
	"bytes"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

func TestLogPanic(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		var buf bytes.Buffer
		logger := logrus.New()
		logger.SetOutput(&buf)
		logger.SetLevel(logrus.ErrorLevel)
		orig := Log
		Log = logger
		t.Cleanup(func() { Log = orig })

		LogPanic("boom")

		out := buf.String()
		assert.Contains(t, out, "panic: boom")
		assert.Contains(t, out, "stack trace")
		assert.Contains(t, out, "goroutine")
	})
	t.Run("Nil", func(t *testing.T) {
		var buf bytes.Buffer
		logger := logrus.New()
		logger.SetOutput(&buf)
		orig := Log
		Log = logger
		t.Cleanup(func() { Log = orig })

		LogPanic(nil)

		assert.Empty(t, buf.String())
	})
	t.Run("NoLogger", func(t *testing.T) {
		orig := Log
		Log = nil
		t.Cleanup(func() { Log = orig })

		assert.NotPanics(t, func() { LogPanic("boom") })
	})
}

func TestRecover(t *testing.T) {
	t.Run("Panic", func(t *testing.T) {
		var buf bytes.Buffer
		logger := logrus.New()
		logger.SetOutput(&buf)
		logger.SetLevel(logrus.ErrorLevel)
		orig := Log
		Log = logger
		t.Cleanup(func() { Log = orig })

		func() {
			defer Recover()
			panic("kaboom")
		}()

		out := buf.String()
		assert.Contains(t, out, "panic: kaboom")
		assert.Contains(t, out, "goroutine")
	})
	t.Run("NoPanic", func(t *testing.T) {
		var buf bytes.Buffer
		logger := logrus.New()
		logger.SetOutput(&buf)
		orig := Log
		Log = logger
		t.Cleanup(func() { Log = orig })

		func() { defer Recover() }()

		assert.Empty(t, buf.String())
	})
}

func TestSafe(t *testing.T) {
	t.Run("RecoversAndContinues", func(t *testing.T) {
		var buf bytes.Buffer
		logger := logrus.New()
		logger.SetOutput(&buf)
		logger.SetLevel(logrus.ErrorLevel)
		orig := Log
		Log = logger
		t.Cleanup(func() { Log = orig })

		ran := 0
		assert.NotPanics(t, func() {
			Safe(func() { panic("boom") })
			Safe(func() { ran++ })
		})

		assert.Equal(t, 1, ran)
		assert.Contains(t, buf.String(), "panic: boom")
	})
	t.Run("Success", func(t *testing.T) {
		called := false
		Safe(func() { called = true })
		assert.True(t, called)
	})
}
