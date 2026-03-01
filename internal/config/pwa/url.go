package pwa

import "strings"

// Url represents a URL with a name.
type Url struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

// Urls represents a set of URLs.
type Urls []Url

// StartUrl returns the manifest start_url relative to the app scope when possible.
func StartUrl(scope string, frontendUri string) string {
	if frontendUri = strings.TrimSpace(frontendUri); frontendUri == "" {
		return ""
	}

	if strings.HasPrefix(frontendUri, "//") || strings.Contains(frontendUri, "://") {
		return frontendUri
	}

	if !strings.HasPrefix(frontendUri, "/") {
		frontendUri = "/" + frontendUri
	}

	if scope = strings.TrimSpace(scope); scope == "" {
		scope = "/"
	}

	if !strings.HasPrefix(scope, "/") {
		scope = "/" + scope
	}

	if !strings.HasSuffix(scope, "/") {
		scope += "/"
	}

	if scope == "/" {
		return strings.TrimPrefix(frontendUri, "/")
	}

	if strings.HasPrefix(frontendUri, scope) {
		return strings.TrimPrefix(frontendUri, scope)
	}

	return frontendUri
}

// shortcutUrl joins a route with the frontend base URI used by the SPA.
func shortcutUrl(frontendUri string, route string) string {
	return strings.TrimRight(frontendUri, "/") + "/" + strings.TrimLeft(route, "/")
}

// Shortcuts specifies links to key tasks or pages within the web application,
// see https://developer.mozilla.org/en-US/docs/Web/Manifest/Reference/shortcuts.
func Shortcuts(frontendUri string) Urls {
	return Urls{
		{
			Name: "Search",
			Url:  shortcutUrl(frontendUri, "browse"),
		},
		{
			Name: "Albums",
			Url:  shortcutUrl(frontendUri, "albums"),
		},
		{
			Name: "Places",
			Url:  shortcutUrl(frontendUri, "places"),
		},
		{
			Name: "Settings",
			Url:  shortcutUrl(frontendUri, "settings"),
		},
	}
}

// PhotoPrism specifies the developer contact URL.
var PhotoPrism = Url{
	"PhotoPrism",
	"https://www.photoprism.app/",
}
