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

RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates

RUN mkdir -p logs

COPY --from=build /app/api .

EXPOSE 8080

CMD ["./api"]
