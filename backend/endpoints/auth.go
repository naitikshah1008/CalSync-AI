package endpoints

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"calsync-ai-backend/internal"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/idtoken"
)

var AppConfig internal.Config
var DB *sql.DB

func InitDependencies(cfg internal.Config, db *sql.DB) {
	AppConfig = cfg
	DB = db
}

func oauthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     AppConfig.GoogleClientID,
		ClientSecret: AppConfig.GoogleClientSecret,
		RedirectURL:  AppConfig.GoogleRedirectURL,
		Scopes: []string{
			"openid",
			"email",
			"profile",
			"https://www.googleapis.com/auth/calendar",
			"https://www.googleapis.com/auth/calendar.events",
		},
		Endpoint: google.Endpoint,
	}
}

func GoogleLoginHandler(w http.ResponseWriter, r *http.Request) {
	state, err := randomToken(32)
	if err != nil {
		http.Error(w, "failed to create oauth state", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "google_oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
		MaxAge:   600,
	})

	url := oauthConfig().AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "consent"),
	)

	http.Redirect(w, r, url, http.StatusFound)
}

func GoogleOAuthCallbackHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if code == "" || state == "" {
		http.Error(w, "missing code or state", http.StatusBadRequest)
		return
	}

	stateCookie, err := r.Cookie("google_oauth_state")
	if err != nil || stateCookie.Value != state {
		http.Error(w, "invalid oauth state", http.StatusBadRequest)
		return
	}

	token, err := oauthConfig().Exchange(ctx, code)
	if err != nil {
		http.Error(w, "failed to exchange code", http.StatusInternalServerError)
		return
	}

	rawIDToken, _ := token.Extra("id_token").(string)
	if rawIDToken == "" {
		http.Error(w, "missing id_token", http.StatusInternalServerError)
		return
	}

	payload, err := idtoken.Validate(ctx, rawIDToken, AppConfig.GoogleClientID)
	if err != nil {
		http.Error(w, "invalid id_token", http.StatusUnauthorized)
		return
	}

	googleSub, _ := payload.Claims["sub"].(string)
	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	if googleSub == "" || email == "" {
		http.Error(w, "missing required Google identity claims", http.StatusUnauthorized)
		return
	}

	userID, err := upsertUserAndToken(ctx, googleSub, email, name, picture, rawIDToken, token)
	if err != nil {
		http.Error(w, "failed to save user session", http.StatusInternalServerError)
		return
	}

	sessionID, err := createSession(ctx, userID)
	if err != nil {
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     AppConfig.SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
		MaxAge:   60 * 60 * 24 * 7,
	})

	http.Redirect(w, r, AppConfig.FrontendRedirectURL, http.StatusSeeOther)
}

func AuthMeHandler(w http.ResponseWriter, r *http.Request) {
	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user": user,
	})
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(AppConfig.SessionCookieName)
	if err == nil && cookie.Value != "" {
		_, _ = DB.Exec(`DELETE FROM sessions WHERE id = $1`, cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     AppConfig.SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

type CurrentUser struct {
	ID      int    `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func currentUserFromRequest(r *http.Request) (*CurrentUser, error) {
	cookie, err := r.Cookie(AppConfig.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil, err
	}

	row := DB.QueryRow(`
		SELECT u.id, u.email, COALESCE(u.name, ''), COALESCE(u.picture, '')
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.id = $1 AND s.expires_at > NOW()
	`, cookie.Value)

	var user CurrentUser
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &user.Picture); err != nil {
		return nil, err
	}
	return &user, nil
}

func upsertUserAndToken(
	ctx context.Context,
	googleSub, email, name, picture, rawIDToken string,
	token *oauth2.Token,
) (int, error) {
	tx, err := DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var userID int
	err = tx.QueryRow(`
		INSERT INTO users (google_sub, email, name, picture, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (google_sub)
		DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			picture = EXCLUDED.picture,
			updated_at = NOW()
		RETURNING id
	`, googleSub, email, name, picture).Scan(&userID)
	if err != nil {
		return 0, err
	}

	scope := ""
	if v, ok := token.Extra("scope").(string); ok {
		scope = v
	}

	_, err = tx.Exec(`
		INSERT INTO google_tokens (user_id, access_token, refresh_token, token_type, expiry, id_token, scope, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			access_token = EXCLUDED.access_token,
			refresh_token = COALESCE(NULLIF(EXCLUDED.refresh_token, ''), google_tokens.refresh_token),
			token_type = EXCLUDED.token_type,
			expiry = EXCLUDED.expiry,
			id_token = EXCLUDED.id_token,
			scope = EXCLUDED.scope,
			updated_at = NOW()
	`, userID, token.AccessToken, token.RefreshToken, token.TokenType, token.Expiry, rawIDToken, scope)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return userID, nil
}

func createSession(ctx context.Context, userID int) (string, error) {
	sessionID, err := randomToken(48)
	if err != nil {
		return "", err
	}

	_, err = DB.ExecContext(ctx, `
		INSERT INTO sessions (id, user_id, expires_at)
		VALUES ($1, $2, $3)
	`, sessionID, userID, time.Now().Add(7*24*time.Hour))
	if err != nil {
		return "", err
	}

	return sessionID, nil
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
