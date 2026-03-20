# ── Build stage ──────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Copy dependency files first (Docker layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 go build -o /build/api ./cmd/api
RUN CGO_ENABLED=0 go build -o /build/worker ./cmd/worker

# ── Run stage ────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /build/api .
COPY --from=builder /build/worker .
COPY migrations/ ./migrations/

EXPOSE 8080

CMD ["./api"]