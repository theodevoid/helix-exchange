package engine

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"
	"github.com/shopspring/decimal"

	"helix-exchange/engine/internal/book"
	"helix-exchange/engine/internal/domain"
	"helix-exchange/engine/internal/events"
)

// OrderAcceptedCommand is the payload for eventType "created".
type OrderAcceptedCommand struct {
	EventType         string  `json:"eventType"`
	OrderID           string  `json:"orderId"`
	UserID            string  `json:"userId"`
	MarketID          string  `json:"marketId"`
	Side              string  `json:"side"`
	Type              string  `json:"type"`
	Price             *string `json:"price"`
	Quantity          string  `json:"quantity"`
	RemainingQuantity string  `json:"remainingQuantity"`
	Status            string  `json:"status"`
	CreatedAt         string  `json:"createdAt"`
}

// OrderCancelledCommand is the payload for eventType "cancelled".
type OrderCancelledCommand struct {
	EventType string `json:"eventType"`
	OrderID   string `json:"orderId"`
}

// Processor handles order commands and runs matching.
type Processor struct {
	books           map[string]*book.OrderBook
	booksMu         sync.RWMutex
	publisher       events.EventPublisher
	processedOrders map[string]struct{} // orderID for idempotency (duplicate OrderAccepted)
	processedMu     sync.Mutex
}

// NewProcessor creates a processor with the given publisher.
func NewProcessor(publisher events.EventPublisher) *Processor {
	return &Processor{
		books:          make(map[string]*book.OrderBook),
		publisher:      publisher,
		processedOrders: make(map[string]struct{}),
	}
}

// ProcessCommand handles a single command message.
// marketSubject is the subject suffix, e.g. "ACME_USD" from "orders.commands.ACME_USD".
func (p *Processor) ProcessCommand(marketSubject string, data []byte) error {
	var raw struct {
		EventType string `json:"eventType"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	switch raw.EventType {
	case "created":
		return p.handleOrderAccepted(marketSubject, data)
	case "cancelled":
		return p.handleOrderCancelled(marketSubject, data)
	default:
		log.Debug().Str("eventType", raw.EventType).Msg("ignoring unknown command type")
		return nil
	}
}

func (p *Processor) getOrCreateBook(marketSubject string) *book.OrderBook {
	p.booksMu.RLock()
	b, ok := p.books[marketSubject]
	p.booksMu.RUnlock()
	if ok {
		return b
	}
	p.booksMu.Lock()
	defer p.booksMu.Unlock()
	if b, ok = p.books[marketSubject]; ok {
		return b
	}
	b = book.NewOrderBook(marketSubject)
	p.books[marketSubject] = b
	return b
}

func (p *Processor) handleOrderAccepted(marketSubject string, data []byte) error {
	var cmd OrderAcceptedCommand
	if err := json.Unmarshal(data, &cmd); err != nil {
		return err
	}

	price := decimal.Zero
	if cmd.Price != nil && *cmd.Price != "" {
		var err error
		price, err = decimal.NewFromString(*cmd.Price)
		if err != nil {
			return err
		}
	}
	qty, err := decimal.NewFromString(cmd.Quantity)
	if err != nil {
		return err
	}

	side := parseSide(cmd.Side)
	orderType := parseOrderType(cmd.Type)
	if side == -1 || orderType == -1 {
		log.Warn().Str("side", cmd.Side).Str("type", cmd.Type).Msg("invalid side or type, skipping")
		return nil
	}

	// Idempotency: tolerate duplicate OrderAccepted per README
	p.processedMu.Lock()
	if _, seen := p.processedOrders[cmd.OrderID]; seen {
		p.processedMu.Unlock()
		log.Debug().Str("orderId", cmd.OrderID).Msg("duplicate OrderAccepted, ignoring")
		return nil
	}
	p.processedOrders[cmd.OrderID] = struct{}{}
	p.processedMu.Unlock()

	ob := p.getOrCreateBook(marketSubject)
	ob.SetMarketUUID(cmd.MarketID)
	seq := ob.NextSequence()
	o := domain.NewOrder(cmd.OrderID, cmd.UserID, cmd.MarketID, side, orderType, price, qty, seq)

	result := book.Match(ob, &o)

	// Add resting order to book if limit order has remainder
	if result.RestingOrder != nil {
		ob.AddLimitOrder(result.RestingOrder)
	}

	// Publish events
	for _, t := range result.Trades {
		if err := p.publisher.PublishTrade(marketSubject, t); err != nil {
			return err
		}
	}
	for _, upd := range result.OrderUpdates {
		eventType := events.EventTypeOrderPartiallyFilled
		if upd.Status == domain.OrderStatusFilled {
			eventType = events.EventTypeOrderFilled
		}
		if err := p.publisher.PublishOrderEvent(marketSubject, upd, eventType); err != nil {
			return err
		}
	}
	for _, c := range result.CancelledOrders {
		if err := p.publisher.PublishOrderEvent(marketSubject, c, events.EventTypeOrderCancelled); err != nil {
			return err
		}
	}

	return nil
}

func (p *Processor) handleOrderCancelled(marketSubject string, data []byte) error {
	var cmd OrderCancelledCommand
	if err := json.Unmarshal(data, &cmd); err != nil {
		return err
	}

	ob := p.getOrCreateBook(marketSubject)
	o, found := ob.CancelOrder(cmd.OrderID)
	if !found {
		log.Debug().Str("orderId", cmd.OrderID).Msg("cancel: order not in book, ignoring")
		return nil
	}

	return p.publisher.PublishOrderEvent(marketSubject, o, events.EventTypeOrderCancelled)
}

func parseSide(s string) domain.OrderSide {
	switch strings.ToUpper(s) {
	case "BUY":
		return domain.OrderSideBuy
	case "SELL":
		return domain.OrderSideSell
	}
	return -1
}

func parseOrderType(s string) domain.OrderType {
	switch strings.ToUpper(s) {
	case "LIMIT":
		return domain.OrderTypeLimit
	case "MARKET":
		return domain.OrderTypeMarket
	}
	return -1
}
