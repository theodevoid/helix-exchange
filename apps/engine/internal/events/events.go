package events

import (
	"encoding/json"
	"time"

	"github.com/shopspring/decimal"

	"helix-exchange/engine/internal/domain"
)

// Event types for orders and trades.
const (
	EventTypeTradeExecuted       = "TradeExecuted"
	EventTypeOrderFilled         = "OrderFilled"
	EventTypeOrderPartiallyFilled = "OrderPartiallyFilled"
	EventTypeOrderCancelled      = "OrderCancelled"
)

// TradeExecutedPayload is published to trades.events.{market}.
type TradeExecutedPayload struct {
	EventType   string `json:"eventType"`
	ID          string `json:"id"`
	MarketID    string `json:"marketId"`
	BuyOrderID  string `json:"buyOrderId"`
	SellOrderID string `json:"sellOrderId"`
	Price       string `json:"price"`
	Quantity    string `json:"quantity"`
	ExecutedAt  string `json:"executedAt"`
	Sequence    uint64 `json:"sequence"`
}

// OrderEventPayload is published to orders.events.{market}.
type OrderEventPayload struct {
	EventType         string `json:"eventType"`
	OrderID           string `json:"orderId"`
	MarketID          string `json:"marketId"`
	UserID            string `json:"userId"`
	Side              string `json:"side"`
	Type              string `json:"type"`
	Price             string `json:"price,omitempty"`
	Quantity          string `json:"quantity"`
	RemainingQuantity string `json:"remainingQuantity"`
	Status            string `json:"status"`
	CreatedAt         string `json:"createdAt,omitempty"`
}

// TradeToPayload converts a domain trade to the event payload.
func TradeToPayload(t *domain.Trade) TradeExecutedPayload {
	return TradeExecutedPayload{
		EventType:   EventTypeTradeExecuted,
		ID:          t.ID,
		MarketID:    t.MarketID,
		BuyOrderID:  t.BuyOrderID,
		SellOrderID: t.SellOrderID,
		Price:       t.Price.String(),
		Quantity:    t.Quantity.String(),
		ExecutedAt:  t.ExecutedAt.UTC().Format(time.RFC3339Nano),
		Sequence:    t.Sequence,
	}
}

// OrderToFilledPayload creates an OrderFilled event.
func OrderToFilledPayload(o *domain.Order) OrderEventPayload {
	return orderToPayload(o, EventTypeOrderFilled)
}

// OrderToPartiallyFilledPayload creates an OrderPartiallyFilled event.
func OrderToPartiallyFilledPayload(o *domain.Order) OrderEventPayload {
	return orderToPayload(o, EventTypeOrderPartiallyFilled)
}

// OrderToCancelledPayload creates an OrderCancelled event.
func OrderToCancelledPayload(o *domain.Order) OrderEventPayload {
	return orderToPayload(o, EventTypeOrderCancelled)
}

func orderToPayload(o *domain.Order, eventType string) OrderEventPayload {
	price := ""
	if o.Price.GreaterThan(decimal.Zero) {
		price = o.Price.String()
	}
	return OrderEventPayload{
		EventType:         eventType,
		OrderID:           o.ID,
		MarketID:          o.MarketID,
		UserID:            o.UserID,
		Side:              o.Side.String(),
		Type:              o.Type.String(),
		Price:             price,
		Quantity:          o.Quantity.String(),
		RemainingQuantity: o.RemainingQuantity.String(),
		Status:            o.Status.String(),
		CreatedAt:         o.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
}

// EncodePayload marshals a payload to JSON.
func EncodePayload(p any) ([]byte, error) {
	return json.Marshal(p)
}
