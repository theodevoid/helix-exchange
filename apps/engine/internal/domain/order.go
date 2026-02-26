package domain

import (
	"time"

	"github.com/shopspring/decimal"
)

// Order represents a limit or market order in the matching engine.
// All monetary/quantity fields use decimal.Decimal for precision-safe arithmetic.
type Order struct {
	ID                string
	UserID            string
	MarketID          string
	Side              OrderSide
	Type              OrderType
	Price             decimal.Decimal // Zero for market orders where price is irrelevant
	Quantity          decimal.Decimal
	RemainingQuantity decimal.Decimal
	Status            OrderStatus
	Sequence          uint64    // Deterministic FIFO ordering within a price level
	CreatedAt         time.Time // For display/audit; matching uses Sequence
}

// NewOrder creates an order with remaining quantity equal to total quantity.
func NewOrder(
	id string,
	userID string,
	marketID string,
	side OrderSide,
	orderType OrderType,
	price decimal.Decimal,
	quantity decimal.Decimal,
	sequence uint64,
) Order {
	return Order{
		ID:                id,
		UserID:            userID,
		MarketID:          marketID,
		Side:              side,
		Type:              orderType,
		Price:             price,
		Quantity:          quantity,
		RemainingQuantity: quantity,
		Status:            OrderStatusNew,
		Sequence:          sequence,
		CreatedAt:         time.Now(),
	}
}

// IsFilled returns true if no quantity remains.
func (o *Order) IsFilled() bool {
	return o.RemainingQuantity.IsZero()
}

// IsLimit returns true for limit orders.
func (o *Order) IsLimit() bool {
	return o.Type == OrderTypeLimit
}

// IsMarket returns true for market orders.
func (o *Order) IsMarket() bool {
	return o.Type == OrderTypeMarket
}
