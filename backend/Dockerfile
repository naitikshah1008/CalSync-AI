# Build stage
FROM golang:1.24 AS build

WORKDIR /app
COPY . .

# Build the Go API
RUN go mod tidy
RUN go build -o api ./cmd/api

# Runtime stage
FROM debian:stable-slim

WORKDIR /app

RUN mkdir -p logs data

COPY --from=build /app/api .
COPY --from=build /app/data ./data

EXPOSE 8080

CMD ["./api"]
