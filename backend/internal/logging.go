package internal

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)

type requestCSVLogger struct {
	file   *os.File
	writer *csv.Writer
	mu     sync.Mutex
}

var logger *requestCSVLogger

// InitRequestLogger initializes the global CSV logger.
func InitRequestLogger(path string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	w := csv.NewWriter(f)
	// write header if file is new/empty
	info, err := f.Stat()
	if err == nil && info.Size() == 0 {
		_ = w.Write([]string{
			"time",
			"method",
			"path",
			"params",
			"body",
			"remote_addr",
			"duration",
		})
		w.Flush()
	}
	logger = &requestCSVLogger{
		file:   f,
		writer: w,
	}
	return nil
}

// CloseRequestLogger flushes and closes the CSV file.
func CloseRequestLogger() error {
	if logger == nil {
		return nil
	}
	logger.mu.Lock()
	defer logger.mu.Unlock()
	logger.writer.Flush()
	return logger.file.Close()
}

func paramsToString(m map[string][]string) string {
	b, err := json.Marshal(m)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// LoggingMiddleware logs each request to the CSV file.
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		// Only log POSTs? uncomment if you want that:
		// if r.Method != http.MethodPost {
		//     next.ServeHTTP(w, r)
		//     return
		// }
		// Read body for logging + restore for handler
		var bodyBytes []byte
		if r.Body != nil {
			bodyBytes, _ = io.ReadAll(r.Body)
			r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}
		_ = r.ParseForm()
		bodyPreview := string(bodyBytes)
		const maxBodyLog = 500
		if len(bodyPreview) > maxBodyLog {
			bodyPreview = bodyPreview[:maxBodyLog] + "...(truncated)"
		}
		next.ServeHTTP(w, r)
		if logger == nil {
			return
		}
		logger.mu.Lock()
		defer logger.mu.Unlock()
		_ = logger.writer.Write([]string{
			time.Now().Format(time.RFC3339),
			r.Method,
			r.URL.Path,
			paramsToString(r.Form), // query + form params
			bodyPreview,
			r.RemoteAddr,
			time.Since(start).String(),
		})
		logger.writer.Flush()
	})
}
