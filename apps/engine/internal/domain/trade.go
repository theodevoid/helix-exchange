package domain

import (
	"time"

	"github.com/shopspring/decimal"
)

// Trade represents an executed trade between a buy and sell order.
// All monetary/quantity fields use decimal.Decimal for precision-safe arithmetic.
type Trade struct {
	ID          string
	MarketID    string
	BuyOrderID  string
	SellOrderID string
	Price       decimal.Decimal
	Quantity    decimal.Decimal
	ExecutedAt  time.Time
	Sequence    uint64 // Deterministic ordering of trades
}

// NewTrade creates a trade record.
func NewTrade(
	id string,
	marketID string,
	buyOrderID string,
	sellOrderID string,
	price decimal.Decimal,
	quantity decimal.Decimal,
	sequence uint64,
) Trade {
	return Trade{
		ID:          id,
		MarketID:    marketID,
		BuyOrderID:  buyOrderID,
		SellOrderID: sellOrderID,
		Price:       price,
		Quantity:    quantity,
		ExecutedAt:  time.Now(),
		Sequence:    sequence,
	}
}
