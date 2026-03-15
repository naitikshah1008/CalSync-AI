package internal

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv              string
	BackendAddr         string
	FrontendOrigin      string
	FrontendRedirectURL string

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	SessionCookieName string
	SessionSecret     string

	DatabaseURL string
}

func LoadConfig() Config {
	_ = godotenv.Load(".env")

	cfg := Config{
		AppEnv:              getEnv("APP_ENV", "development"),
		BackendAddr:         getEnv("BACKEND_ADDR", ":8080"),
		FrontendOrigin:      getEnv("FRONTEND_ORIGIN", "http://localhost:8000"),
		FrontendRedirectURL: getEnv("FRONTEND_REDIRECT_URL", "http://localhost:8000/main.html"),

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),

		SessionCookieName: getEnv("SESSION_COOKIE_NAME", "calsync_session"),
		SessionSecret:     os.Getenv("SESSION_SECRET"),

		DatabaseURL: os.Getenv("DATABASE_URL"),
	}

	if cfg.GoogleClientID == "" || cfg.GoogleClientSecret == "" || cfg.GoogleRedirectURL == "" {
		log.Fatal("missing Google OAuth env vars")
	}
	if cfg.SessionSecret == "" {
		log.Fatal("missing SESSION_SECRET")
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("missing DATABASE_URL")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
