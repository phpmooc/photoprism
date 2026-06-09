package api

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/photoprism/photoprism/internal/photoprism/get"
	"github.com/photoprism/photoprism/pkg/http/header"
)

// oauthWantsHTML reports whether an OAuth/OIDC error should be rendered as a
// branded HTML page rather than the standard JSON body. A top-level browser
// navigation to the authorize endpoint carries Sec-Fetch-Mode: navigate and an
// Accept header that prefers text/html; programmatic API clients send
// Accept: application/json (or no Accept) and keep receiving JSON.
func oauthWantsHTML(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	if strings.Contains(strings.ToLower(c.GetHeader(header.FetchMode)), "navigate") {
		return true
	}
	return strings.Contains(strings.ToLower(c.GetHeader(header.Accept)), gin.MIMEHTML)
}

// RenderOAuthError responds to a non-redirectable OAuth/OIDC error: a branded
// HTML page for a browser, or the standard JSON error body for an API client,
// chosen by content negotiation. Use it only when there is no trusted
// redirect_uri to send the user back to — RFC 6749 §4.1.2.1 forbids redirecting
// to an unverified URI. The JSON shape and status code are preserved unchanged
// for non-browser callers.
func RenderOAuthError(c *gin.Context, statusCode int, errCode, errDescription string) {
	if c == nil {
		return
	}

	c.Header(header.CacheControl, header.CacheControlNoStore)

	if oauthWantsHTML(c) {
		c.HTML(statusCode, "oauth-error.gohtml", gin.H{
			"config":            get.Config().ClientPublic(),
			"code":              statusCode,
			"error":             errCode,
			"error_description": errDescription,
		})
		c.Abort()
		return
	}

	c.AbortWithStatusJSON(statusCode, gin.H{
		"error":             errCode,
		"error_description": errDescription,
	})
}

// RedirectOAuthError sends the browser back to a validated redirect_uri with the
// standard error, error_description, and echoed state query parameters (RFC 6749
// §4.1.2.1), so the instance RP renders the failure in its own branded UI.
// Callers MUST have verified redirectURI against the client's registered URIs
// first. Falls back to RenderOAuthError when redirectURI cannot be parsed, so a
// malformed URI is never followed.
func RedirectOAuthError(c *gin.Context, redirectURI, state, errCode, errDescription string) {
	if c == nil {
		return
	}

	u, err := url.Parse(redirectURI)
	if err != nil || u.Scheme == "" || u.Host == "" {
		RenderOAuthError(c, http.StatusBadRequest, "invalid_request", "invalid redirect_uri")
		return
	}

	q := u.Query()
	q.Set("error", errCode)
	if errDescription != "" {
		q.Set("error_description", errDescription)
	}
	if state != "" {
		q.Set("state", state)
	}
	u.RawQuery = q.Encode()

	c.Header(header.CacheControl, header.CacheControlNoStore)
	c.Redirect(http.StatusFound, u.String())
	c.Abort()
}
