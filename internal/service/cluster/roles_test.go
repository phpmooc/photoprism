package cluster

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeNodeRole(t *testing.T) {
	t.Run("Tenant", func(t *testing.T) {
		assert.Equal(t, RoleTenant, NormalizeNodeRole("tenant"))
	})

	t.Run("LegacyAliasAppToTenant", func(t *testing.T) {
		assert.Equal(t, RoleTenant, NormalizeNodeRole(" app "))
	})

	t.Run("Portal", func(t *testing.T) {
		assert.Equal(t, RolePortal, NormalizeNodeRole("portal"))
	})

	t.Run("Service", func(t *testing.T) {
		assert.Equal(t, RoleService, NormalizeNodeRole("service"))
	})

	t.Run("Invalid", func(t *testing.T) {
		assert.Equal(t, NodeRole(""), NormalizeNodeRole("unknown"))
	})
}
