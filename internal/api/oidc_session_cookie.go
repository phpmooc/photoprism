package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/photoprism/photoprism/internal/config"
	"github.com/photoprism/photoprism/pkg/clean"
	"github.com/photoprism/photoprism/pkg/rnd"
)

// OIDCSessionCookie is the name of the narrowly-scoped cookie that lets the
// Portal OIDC OP authenticate a browser on a top-level navigation to
// /api/v1/oauth/authorize, which carries no Authorization or X-Auth-Token header.
const OIDCSessionCookie = "oidc_session"

// oidcSessionCookiePath returns the URL path the OP session cookie is scoped to,
// derived from where the OAuth endpoints are mounted (the APIv1 base path plus
// "/oauth"). Scoping to the OAuth subtree keeps the cookie off the general API
// surface, so it adds no CSRF vector to state-changing endpoints, while still
// covering the /oauth/authorize endpoint a top-level browser navigation hits.
func oidcSessionCookiePath(conf *config.Config) string {
	if conf == nil {
		return config.ApiUri + "/oauth"
	}
	return conf.BaseUri(config.ApiUri) + "/oauth"
}

// SetOIDCSessionCookie stores the Portal session token in a narrowly-scoped,
// HttpOnly cookie so the OIDC OP /api/v1/oauth/authorize endpoint can authenticate
// the browser on a top-level navigation. The cookie is honored ONLY by the OP
// authorize handler (see OIDCSessionCookieToken), never as a general API
// authenticator, so it adds no CSRF surface to state-changing endpoints.
func SetOIDCSessionCookie(c *gin.Context, authToken, cookiePath string, maxAge int, secure bool) {
	if c == nil || !rnd.IsAuthToken(authToken) {
		return
	}

	if cookiePath == "" {
		cookiePath = config.ApiUri + "/oauth"
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     OIDCSessionCookie,
		Value:    authToken,
		Path:     cookiePath,
		MaxAge:   maxAge,
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearOIDCSessionCookie removes the OP session cookie, e.g. on logout. The
// cookiePath must match the value used by SetOIDCSessionCookie so the browser
// overwrites the same cookie.
func ClearOIDCSessionCookie(c *gin.Context, cookiePath string, secure bool) {
	if c == nil {
		return
	}

	if cookiePath == "" {
		cookiePath = config.ApiUri + "/oauth"
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     OIDCSessionCookie,
		Value:    "",
		Path:     cookiePath,
		MaxAge:   -1,
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

// OIDCSessionCookieToken returns the session token from the OP session cookie,
// or "" if absent or malformed. It is the only reader of OIDCSessionCookie and
// must be used solely by the OIDC OP authorize handler as a fallback when no
// Authorization/X-Auth-Token header is present on a browser navigation.
func OIDCSessionCookieToken(c *gin.Context) string {
	if c == nil {
		return ""
	}

	v, err := c.Cookie(OIDCSessionCookie)
	if err != nil {
		return ""
	}

	if token := clean.Token(v); rnd.IsAuthToken(token) {
		return token
	}

	return ""
}
