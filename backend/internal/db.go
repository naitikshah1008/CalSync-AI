package internal

import (
	"database/sql"
	"log"

	_ "github.com/lib/pq"
)

func InitDB(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	if err := runMigrations(db); err != nil {
		return nil, err
	}

	log.Println("database connected and migrations applied")
	return db, nil
}

func runMigrations(db *sql.DB) error {
	queries := []string{
		`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			google_sub TEXT UNIQUE NOT NULL,
			email TEXT UNIQUE NOT NULL,
			name TEXT,
			picture TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		`,
		`
		CREATE TABLE IF NOT EXISTS google_tokens (
			user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			access_token TEXT NOT NULL,
			refresh_token TEXT,
			token_type TEXT,
			expiry TIMESTAMPTZ,
			id_token TEXT,
			scope TEXT,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		`,
		`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		`,
		`
		CREATE TABLE IF NOT EXISTS learning_plans (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			goal TEXT NOT NULL,
			total_hours INTEGER,
			plan_json JSONB NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		`,
		`
		CREATE TABLE IF NOT EXISTS schedules (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			learning_plan_id INTEGER REFERENCES learning_plans(id) ON DELETE SET NULL,
			preferences_json JSONB NOT NULL,
			schedule_json JSONB NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		`,
		`
		ALTER TABLE schedules
		ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
		`,
		`
		ALTER TABLE schedules
		ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
		`,
		`
		CREATE TABLE IF NOT EXISTS schedule_events (
			id SERIAL PRIMARY KEY,
			schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			google_event_id TEXT NOT NULL,
			html_link TEXT,
			title TEXT NOT NULL,
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		`,
		`
		CREATE UNIQUE INDEX IF NOT EXISTS schedule_events_google_event_id_idx
		ON schedule_events (google_event_id);
		`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}

	return nil
}
