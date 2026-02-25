package security

import "testing"

// TestHashPath verifies deterministic hashing and path lookup behavior.
func TestHashPath(t *testing.T) {
	t.Run("Deterministic", func(t *testing.T) {
		const path = "/wp-login.php"
		a := HashPath(path)
		b := HashPath(path)

		if a == 0 {
			t.Fatalf("expected non-zero hash for %q", path)
		}

		if a != b {
			t.Fatalf("expected deterministic hash for %q", path)
		}
	})

	t.Run("IsScanPath", func(t *testing.T) {
		if !IsScanPath("/wp-login.php") {
			t.Fatalf("expected scanner path to be detected")
		}

		if IsScanPath("/library") {
			t.Fatalf("expected non-scanner path to be ignored")
		}
	})
}
