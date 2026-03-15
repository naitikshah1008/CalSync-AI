package main

import (
	"calsync-ai-backend/endpoints"
	"calsync-ai-backend/internal"
	"log"
	"net/http"
)

func initApp() (http.Handler, internal.Config, error) {
	cfg := internal.LoadConfig()
	db, err := internal.InitDB(cfg.DatabaseURL)
	if err != nil {
		return nil, cfg, err
	}
	if err := internal.InitRequestLogger("logs/requests_log.csv"); err != nil {
		return nil, cfg, err
	}
	endpoints.InitDependencies(cfg, db)
	mux := http.NewServeMux()
	mux.HandleFunc("/auth/google/login", endpoints.GoogleLoginHandler)
	mux.HandleFunc("/auth/google/callback", endpoints.GoogleOAuthCallbackHandler)
	mux.HandleFunc("/auth/me", endpoints.AuthMeHandler)
	mux.HandleFunc("/auth/logout", endpoints.LogoutHandler)
	mux.HandleFunc("/api/v1/calendar/events", endpoints.GoogleListEventsHandler)
	mux.HandleFunc("/api/v1/calendar/events/create", endpoints.GoogleCreateEventHandler)
	mux.HandleFunc("/api/v1/ai/generate-learning-plan", endpoints.GenerateLearningPlanHandler)
	mux.HandleFunc("/api/v1/ai/generate-schedule", endpoints.GenerateScheduleHandler)
	mux.HandleFunc("/api/v1/ai/apply-schedule", endpoints.ApplyScheduleHandler)
	mux.HandleFunc("/api/v1/ai/learning-plans", endpoints.ListLearningPlansHandler)
	mux.HandleFunc("/api/v1/ai/schedules", endpoints.ListSchedulesHandler)
	mux.HandleFunc("/api/v1/ai/schedule-events", endpoints.ListScheduleEventsHandler)
	mux.HandleFunc("/api/v1/ai/learning-plans/delete", endpoints.DeleteLearningPlanHandler)
	mux.HandleFunc("/api/v1/ai/schedules/delete", endpoints.DeleteScheduleHandler)
	mux.HandleFunc("/mcp", endpoints.MCPHandler)
	return internal.LoggingMiddleware(mux), cfg, nil
}

func main() {
	handler, cfg, err := initApp()
	if err != nil {
		log.Fatalf("failed to init app: %v", err)
	}
	defer internal.CloseRequestLogger()
	log.Printf("Server running at http://localhost%s\n", cfg.BackendAddr)
	if err := http.ListenAndServe(cfg.BackendAddr, handler); err != nil {
		log.Fatal(err)
	}
}
