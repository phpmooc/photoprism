package oidc

import (
	"net/url"
)

// EndSessionURL builds an RP-initiated logout URL for redirecting the browser to the
// provider's end_session_endpoint, so the provider can end its own SSO session. It returns
// an empty string (and no error) when the provider advertises no end_session_endpoint, so
// callers can fall back to a local-only logout.
//
// The returned URL must be followed by a top-level browser navigation, not a server-side
// request: only the browser carries the provider's SSO cookie that needs clearing. This is
// why we build the URL here instead of using rp.EndSession, which performs the request
// server-side.
func (c *Client) EndSessionURL(idToken, postLogoutRedirectURI, state string) (string, error) {
	endpoint := c.GetEndSessionEndpoint()

	if endpoint == "" {
		return "", nil
	}

	u, err := url.Parse(endpoint)

	if err != nil {
		return "", err
	}

	q := u.Query()
	q.Set("id_token_hint", idToken)

	if clientID := c.OAuthConfig().ClientID; clientID != "" {
		q.Set("client_id", clientID)
	}

	if postLogoutRedirectURI != "" {
		q.Set("post_logout_redirect_uri", postLogoutRedirectURI)
	}

	if state != "" {
		q.Set("state", state)
	}

	u.RawQuery = q.Encode()

	return u.String(), nil
}
