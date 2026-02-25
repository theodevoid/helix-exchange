package app

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"helix-exchange/engine/internal/config"
)

func Run(ctx context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Structured logger
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	if os.Getenv("ENV") != "production" {
		logger = logger.Output(zerolog.ConsoleWriter{Out: os.Stdout})
	}
	log.Logger = logger

	// NATS connection
	nc, err := nats.Connect(cfg.NatsURL, nats.MaxReconnects(cfg.NatsMaxReconnect))
	if err != nil {
		logger.Error().Err(err).Msg("failed to connect to NATS")
		return err
	}
	defer nc.Close()

	logger.Info().Msg("engine started, NATS connected")

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-ctx.Done():
		logger.Info().Msg("context cancelled, shutting down")
	case sig := <-sigCh:
		logger.Info().Str("signal", sig.String()).Msg("received signal, shutting down")
	}

	return nil
}
