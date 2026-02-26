package app

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"

	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"helix-exchange/engine/internal/config"
	"helix-exchange/engine/internal/events"
	"helix-exchange/engine/internal/engine"
)

const ordersCommandsPrefix = "orders.commands."

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

	publisher := events.NewPublisher(nc)
	processor := engine.NewProcessor(publisher)

	// Per-market command channels: marketSubject -> chan
	marketChans := make(map[string]chan *nats.Msg)
	var chansMu sync.RWMutex

	dispatch := func(msg *nats.Msg) {
		subject := msg.Subject
		if !strings.HasPrefix(subject, ordersCommandsPrefix) {
			return
		}
		marketSubject := strings.TrimPrefix(subject, ordersCommandsPrefix)

		chansMu.Lock()
		ch, ok := marketChans[marketSubject]
		if !ok {
			ch = make(chan *nats.Msg, 256)
			marketChans[marketSubject] = ch
			go func() {
				for m := range ch {
					if err := processor.ProcessCommand(marketSubject, m.Data); err != nil {
						logger.Error().Err(err).Str("market", marketSubject).Msg("failed to process command")
					}
					_ = m.Ack()
				}
			}()
		}
		chansMu.Unlock()

		ch <- msg
	}

	// JetStream subscription
	js, err := nc.JetStream()
	if err != nil {
		logger.Error().Err(err).Msg("failed to get JetStream context")
		return err
	}

	sub, err := js.Subscribe("orders.commands.>", dispatch, nats.Durable("engine"), nats.ManualAck())
	if err != nil {
		logger.Error().Err(err).Msg("failed to subscribe to order commands")
		return err
	}
	defer sub.Unsubscribe()

	logger.Info().Msg("engine started, NATS connected, subscribed to orders.commands.>")

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
