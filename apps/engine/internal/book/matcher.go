package book

import (
	"fmt"
	"github.com/shopspring/decimal"

	"helix-exchange/engine/internal/domain"
)

// MatchResult holds the outcome of matching an order.
type MatchResult struct {
	Trades []*domain.Trade
	// OrderUpdates: orders that had fills (incoming + resting), with updated status/remainingQty
	OrderUpdates []*domain.Order
	// CancelledOrders: orders that were cancelled (market remainder or explicit cancel)
	CancelledOrders []*domain.Order
	// RestingOrder: if limit order has remainder, this is the order to add to book (with updated RemainingQuantity)
	RestingOrder *domain.Order
}

// Match attempts to match an incoming order against the book.
// Caller is responsible for: adding RestingOrder to book if non-nil, publishing events.
func Match(book *OrderBook, incoming *domain.Order) MatchResult {
	var result MatchResult

	if incoming.IsLimit() {
		if incoming.Side == domain.OrderSideBuy {
			matchLimitBuy(book, incoming, &result)
		} else {
			matchLimitSell(book, incoming, &result)
		}
	} else {
		if incoming.Side == domain.OrderSideBuy {
			matchMarketBuy(book, incoming, &result)
		} else {
			matchMarketSell(book, incoming, &result)
		}
	}

	return result
}

func matchLimitBuy(book *OrderBook, incoming *domain.Order, result *MatchResult) {
	for !incoming.IsFilled() {
		bestAsk, level, ok := book.BestAsk()
		if !ok || bestAsk.GreaterThan(incoming.Price) {
			break
		}
		matchAgainstLevel(book, incoming, level, domain.OrderSideSell, result)
	}
	if !incoming.IsFilled() {
		result.RestingOrder = incoming
	}
}

func matchLimitSell(book *OrderBook, incoming *domain.Order, result *MatchResult) {
	for !incoming.IsFilled() {
		bestBid, level, ok := book.BestBid()
		if !ok || bestBid.LessThan(incoming.Price) {
			break
		}
		matchAgainstLevel(book, incoming, level, domain.OrderSideBuy, result)
	}
	if !incoming.IsFilled() {
		result.RestingOrder = incoming
	}
}

func matchMarketBuy(book *OrderBook, incoming *domain.Order, result *MatchResult) {
	for !incoming.IsFilled() {
		_, level, ok := book.BestAsk()
		if !ok {
			break
		}
		matchAgainstLevel(book, incoming, level, domain.OrderSideSell, result)
	}
	if !incoming.IsFilled() {
		result.CancelledOrders = append(result.CancelledOrders, incoming)
	}
}

func matchMarketSell(book *OrderBook, incoming *domain.Order, result *MatchResult) {
	for !incoming.IsFilled() {
		_, level, ok := book.BestBid()
		if !ok {
			break
		}
		matchAgainstLevel(book, incoming, level, domain.OrderSideBuy, result)
	}
	if !incoming.IsFilled() {
		result.CancelledOrders = append(result.CancelledOrders, incoming)
	}
}

func matchAgainstLevel(
	book *OrderBook,
	incoming *domain.Order,
	level *PriceLevel,
	restingSide domain.OrderSide,
	result *MatchResult,
) {
	orderUpdates := make(map[string]*domain.Order)

	for !incoming.IsFilled() && !level.Orders.IsEmpty() {
		resting := level.Orders.Peek()
		fillQty := minDecimal(incoming.RemainingQuantity, resting.RemainingQuantity)

		seq := book.NextSequence()
		marketID := book.MarketUUID
		if marketID == "" {
			marketID = book.MarketID
		}
		trade := domain.NewTrade(
			fmt.Sprintf("%s-trade-%d", book.MarketID, seq),
			marketID,
			orderIDForSide(domain.OrderSideBuy, incoming, resting),
			orderIDForSide(domain.OrderSideSell, incoming, resting),
			level.Price,
			fillQty,
			seq,
		)
		result.Trades = append(result.Trades, &trade)

		incoming.RemainingQuantity = incoming.RemainingQuantity.Sub(fillQty)
		resting.RemainingQuantity = resting.RemainingQuantity.Sub(fillQty)

		updateOrderStatus(incoming)
		orderUpdates[incoming.ID] = incoming

		updateOrderStatus(resting)
		orderUpdates[resting.ID] = resting

		if resting.IsFilled() {
			level.Orders.Dequeue()
			book.RemoveFromIndex(resting.ID)
		}
	}

	for _, o := range orderUpdates {
		result.OrderUpdates = append(result.OrderUpdates, o)
	}

	if level.Orders.IsEmpty() {
		if restingSide == domain.OrderSideBuy {
			book.Bids.Remove(level.Price)
		} else {
			book.Asks.Remove(level.Price)
		}
	}
}

func orderIDForSide(side domain.OrderSide, buy, sell *domain.Order) string {
	if side == domain.OrderSideBuy {
		return buy.ID
	}
	return sell.ID
}

func minDecimal(a, b decimal.Decimal) decimal.Decimal {
	if a.LessThan(b) {
		return a
	}
	return b
}

func updateOrderStatus(o *domain.Order) {
	if o.RemainingQuantity.IsZero() {
		o.Status = domain.OrderStatusFilled
	} else {
		o.Status = domain.OrderStatusPartiallyFilled
	}
}
