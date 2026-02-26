package events

import (
	"github.com/nats-io/nats.go"

	"helix-exchange/engine/internal/domain"
)

// EventPublisher publishes trade and order events. Implemented by Publisher.
type EventPublisher interface {
	PublishTrade(marketSubject string, t *domain.Trade) error
	PublishOrderEvent(marketSubject string, o *domain.Order, eventType string) error
}

// Publisher publishes trade and order events to NATS.
type Publisher struct {
	nc *nats.Conn
}

// NewPublisher creates a publisher for the given NATS connection.
func NewPublisher(nc *nats.Conn) *Publisher {
	return &Publisher{nc: nc}
}

// PublishTrade publishes a trade to trades.events.{market}.
// Market is derived from the trade's MarketID - for subject we need market symbol.
// The engine uses marketId (UUID) - we publish to trades.events.{marketId} for now.
// Downstream can map marketId to symbol if needed.
func (p *Publisher) PublishTrade(marketSubject string, t *domain.Trade) error {
	payload := TradeToPayload(t)
	data, err := EncodePayload(payload)
	if err != nil {
		return err
	}
	subject := "trades.events." + marketSubject
	return p.nc.Publish(subject, data)
}

// PublishOrderEvent publishes an order event to orders.events.{market}.
func (p *Publisher) PublishOrderEvent(marketSubject string, o *domain.Order, eventType string) error {
	var payload OrderEventPayload
	switch eventType {
	case EventTypeOrderFilled:
		payload = OrderToFilledPayload(o)
	case EventTypeOrderPartiallyFilled:
		payload = OrderToPartiallyFilledPayload(o)
	case EventTypeOrderCancelled:
		payload = OrderToCancelledPayload(o)
	default:
		payload = orderToPayload(o, eventType)
	}
	data, err := EncodePayload(payload)
	if err != nil {
		return err
	}
	subject := "orders.events." + marketSubject
	return p.nc.Publish(subject, data)
}
