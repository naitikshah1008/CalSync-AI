package endpoints

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

type SimpleEvent struct {
	ID      string `json:"id"`
	Summary string `json:"summary"`
	Start   string `json:"start"`
	End     string `json:"end"`
}

func getUserToken(ctx context.Context, userID int) (*oauth2.Token, error) {
	row := DB.QueryRowContext(ctx, `
		SELECT access_token, COALESCE(refresh_token, ''), COALESCE(token_type, 'Bearer'), expiry
		FROM google_tokens
		WHERE user_id = $1
	`, userID)
	var accessToken, refreshToken, tokenType string
	var expiry time.Time
	if err := row.Scan(&accessToken, &refreshToken, &tokenType, &expiry); err != nil {
		return nil, err
	}
	return &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    tokenType,
		Expiry:       expiry,
	}, nil
}

func saveUserToken(ctx context.Context, userID int, token *oauth2.Token) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE google_tokens
		SET access_token = $1,
		    refresh_token = COALESCE(NULLIF($2, ''), refresh_token),
		    token_type = $3,
		    expiry = $4,
		    updated_at = NOW()
		WHERE user_id = $5
	`, token.AccessToken, token.RefreshToken, token.TokenType, token.Expiry, userID)
	return err
}
func getCalendarServiceForUser(ctx context.Context, userID int) (*calendar.Service, error) {
	token, err := getUserToken(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to load user token: %w", err)
	}
	cfg := oauthConfig()
	tokenSource := cfg.TokenSource(ctx, token)
	freshToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	if freshToken.AccessToken != token.AccessToken || !freshToken.Expiry.Equal(token.Expiry) {
		_ = saveUserToken(ctx, userID, freshToken)
	}
	httpClient := oauth2.NewClient(ctx, tokenSource)
	srv, err := calendar.NewService(ctx, option.WithHTTPClient(httpClient))
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar service: %w", err)
	}
	return srv, nil
}

func GoogleListEventsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	user, err := currentUserFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	ctx := r.Context()
	srv, err := getCalendarServiceForUser(ctx, user.ID)
	if err != nil {
		http.Error(w, "failed to init calendar service: "+err.Error(), http.StatusInternalServerError)
		return
	}
	now := time.Now()
	events, err := srv.Events.List("primary").
		ShowDeleted(false).
		SingleEvents(true).
		OrderBy("startTime").
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(now.Add(7 * 24 * time.Hour).Format(time.RFC3339)).
		MaxResults(20).
		Do()
	if err != nil {
		http.Error(w, "failed to fetch events: "+err.Error(), http.StatusInternalServerError)
		return
	}
	out := make([]SimpleEvent, 0, len(events.Items))
	for _, e := range events.Items {
		start := ""
		end := ""
		if e.Start != nil {
			if e.Start.DateTime != "" {
				start = e.Start.DateTime
			} else {
				start = e.Start.Date
			}
		}
		if e.End != nil {
			if e.End.DateTime != "" {
				end = e.End.DateTime
			} else {
				end = e.End.Date
			}
		}
		out = append(out, SimpleEvent{
			ID:      e.Id,
			Summary: strings.TrimSpace(e.Summary),
			Start:   start,
			End:     end,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": out})
}

func enableCORS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", AppConfig.FrontendOrigin)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
}
