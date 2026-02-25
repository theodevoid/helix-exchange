# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder
WORKDIR /build
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /engine ./cmd/engine

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /engine .
CMD ["./engine"]
