package cluster

import (
	"strings"

	"github.com/photoprism/photoprism/internal/auth/acl"
)

// NodeRole represents the role a node plays within a cluster.
type NodeRole = string

const (
	// RoleTenant represents a regular PhotoPrism tenant node that can join a cluster.
	RoleTenant = NodeRole(acl.RoleTenant)
	// RolePortal represents a management portal for orchestrating a cluster.
	RolePortal = NodeRole(acl.RolePortal)
	// RoleService represents other services used within a cluster, e.g., Ollama or Vision API.
	RoleService = NodeRole(acl.RoleService)
)

// NormalizeNodeRole maps cluster role aliases to their canonical values.
func NormalizeNodeRole(role string) NodeRole {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "app", RoleTenant:
		return RoleTenant
	case RolePortal:
		return RolePortal
	case RoleService:
		return RoleService
	default:
		return ""
	}
}
