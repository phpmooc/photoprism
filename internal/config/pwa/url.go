package pwa

import "strings"

// Url represents a URL with a name.
type Url struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

// Urls represents a set of URLs.
type Urls []Url

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
