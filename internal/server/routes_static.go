package server

import (
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/photoprism/photoprism/internal/api"
	"github.com/photoprism/photoprism/internal/config"
	"github.com/photoprism/photoprism/pkg/clean"
	"github.com/photoprism/photoprism/pkg/fs"
	"github.com/photoprism/photoprism/pkg/http/header"
	"github.com/photoprism/photoprism/pkg/i18n"
)

const (
	IndexHtml = "index.html"
)

// registerStaticRoutes adds routes for serving static content and templates.
func registerStaticRoutes(router *gin.Engine, conf *config.Config) {
	// Control how crawlers index the site by serving a "robots.txt" file in addition
	// to the "X-Robots-Tag" response header set in the Security middleware:
	// https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
	router.Any(conf.BaseUri("/robots.txt"), func(c *gin.Context) {
		if robotsTxt, _ := conf.RobotsTxt(); len(robotsTxt) == 0 {
			// Return error 404 if file cannot be read or is empty.
			c.Data(http.StatusNotFound, header.ContentTypeText, []byte{})
		} else {
			// Allow clients to cache the response for one day.
			c.Header(header.CacheControl, header.CacheControlMaxAge(header.DurationDay, true))
			c.Data(http.StatusOK, header.ContentTypeText, robotsTxt)
		}
	})

	// Return if the web user interface is disabled.
	if conf.DisableFrontend() {
		log.Info("frontend: disabled")
		router.NoRoute(func(c *gin.Context) {
			api.Abort(c, http.StatusNotFound, i18n.ErrNotFound)
		})
		return
	}

	// Redirects to the login page.
	login := func(c *gin.Context) {
		if conf.OIDCEnabled() && conf.OIDCRedirect() {
			c.Redirect(http.StatusTemporaryRedirect, conf.OIDCLoginUri())
		} else {
			c.Redirect(http.StatusTemporaryRedirect, conf.LoginUri())
		}
	}

	webBase := clean.SlashPath(conf.BasePath())

	// Attach the web request handler to serve assets only if a web storage directory exists.
	if webDir := conf.WebStoragePath(); webDir != "." && webDir != "/" && fs.PathExists(webDir) {
		// Serves static web assets from the web storage path.
		web := func(c *gin.Context) {
			// Gin always provides a valid request context here; only handle GET/HEAD.
			if c.Request.Method != header.MethodGet && c.Request.Method != header.MethodHead {
				return
			}

			// Sanitize and normalize path from request URL.
			absPath := clean.UserPath(c.Request.URL.Path)
			webPath := absPath

			switch {
			case webBase != "" && absPath == webBase:
				// Request targets the base path itself (e.g. "/i/acme"), so map it to index.
				webPath = ""
			case webBase != "" && strings.HasPrefix(absPath, webBase+"/"):
				// Request is under the configured base path; strip the prefix for web storage lookup.
				webPath = strings.TrimPrefix(absPath, webBase+"/")
			case webBase != "":
				// Ignore requests outside the configured base path when a base path is enforced.
				return
			case absPath == "" && c.Request.URL.Path != "/":
				// Reject paths sanitized to empty values, but keep "/" valid so it can resolve to index.
				return
			}

			if webPath == "" {
				webPath = IndexHtml
			} else if path.Ext(webPath) == "" {
				webPath += "/" + IndexHtml
			}

			// Compose absolute file path in web storage directory.
			webFile := filepath.Join(webDir, webPath)

			// Resolve unmatched requests by serving an overlay file, redirecting root,
			// or falling through so the next NoRoute handler can return 404.
			switch {
			case fs.FileExists(webFile):
				// Serve the matched overlay file and stop the NoRoute handler chain.
				log.Debugf("web: serving %s", clean.Log(webFile))
				c.Abort()
				c.File(webFile)
			case webPath == IndexHtml:
				// No root index in overlay: keep the default login/landing redirect behavior.
				c.Abort()
				login(c)
			default:
				// Intentionally do not abort so api.AbortNotFound handles the request next.
				log.Tracef("web: no asset found for request path %s", clean.Log(webPath))
			}
		}

		// Serve overlay assets when available and otherwise fall through to Not Found.
		router.NoRoute(web, api.AbortNotFound)
	} else {
		// Redirect to default login/landing page.
		router.Match(MethodsGetHead, conf.BaseUri("/"), login)

		// Render error 404 Not Found.
		router.NoRoute(api.AbortNotFound)
	}

	// Serves static favicon.
	router.StaticFile(conf.BaseUri("/favicon.ico"), conf.SiteFavicon())

	// Serves bundled assets like JS, CSS, and fonts.
	if dir := conf.StaticPath(); dir != "" {
		group := router.Group(conf.BaseUri(config.StaticUri), Static(conf))
		{
			group.Static("", dir)
		}
	}

	// Serves custom assets, e.g. bundled with extensions.
	if dir := conf.CustomStaticPath(); dir != "" {
		group := router.Group(conf.BaseUri(config.CustomStaticUri), Static(conf))
		{
			group.Static("", dir)
		}
	}

	// Serves rainbow test page.
	router.GET(conf.BaseUri("/_rainbow"), func(c *gin.Context) {
		clientConfig := conf.ClientPublic()
		c.HTML(http.StatusOK, "rainbow.gohtml", gin.H{"config": clientConfig})
	})

	// Serves splash screen test page.
	router.GET(conf.BaseUri("/_splash"), func(c *gin.Context) {
		clientConfig := conf.ClientPublic()
		c.HTML(http.StatusOK, "splash.gohtml", gin.H{"config": clientConfig})
	})
}
