package pwa

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestShortcutUrl(t *testing.T) {
	assert.Equal(t, "/library/browse", shortcutUrl("/library/", "browse"))
	assert.Equal(t, "/portal/admin/settings", shortcutUrl("/portal/admin", "/settings"))
	assert.Equal(t, "/browse", shortcutUrl("", "browse"))
}

func TestShortcuts(t *testing.T) {
	result := Shortcuts("/portal/admin/")

	assert.Equal(t, 4, len(result))
	assert.Equal(t, "/portal/admin/browse", result[0].Url)
	assert.Equal(t, "/portal/admin/albums", result[1].Url)
	assert.Equal(t, "/portal/admin/places", result[2].Url)
	assert.Equal(t, "/portal/admin/settings", result[3].Url)
}
