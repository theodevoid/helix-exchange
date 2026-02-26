package book

import (
	"github.com/shopspring/decimal"

	"helix-exchange/engine/internal/domain"
)

// PriceLevel holds orders at a single price in FIFO order.
type PriceLevel struct {
	Price  decimal.Decimal
	Orders *FIFOQueue
}

// NewPriceLevel creates a price level with one order.
func NewPriceLevel(price decimal.Decimal, o *domain.Order) *PriceLevel {
	q := NewFIFOQueue()
	q.Enqueue(o)
	return &PriceLevel{Price: price, Orders: q}
}
