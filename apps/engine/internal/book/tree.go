package book

import (
	"github.com/emirpasic/gods/v2/maps/treemap"
	"github.com/emirpasic/gods/v2/utils"
	"github.com/shopspring/decimal"
)

// priceKey is a string representation of a decimal price for use as comparable tree key.
type priceKey string

// decimalComparator compares string keys as decimal values (ascending order).
func decimalComparator(a, b string) int {
	da, err := decimal.NewFromString(a)
	if err != nil {
		da = decimal.Zero
	}
	db, err := decimal.NewFromString(b)
	if err != nil {
		db = decimal.Zero
	}
	return da.Cmp(db)
}

// PriceTree holds price levels in sorted order. Ordering is determined by ascending comparator.
// For bids: use Max() to get best (highest) bid. For asks: use Min() to get best (lowest) ask.
type PriceTree struct {
	tree *treemap.Map[string, *PriceLevel]
}

// NewBidTree creates a price tree for bids (use Max() for best bid).
func NewBidTree() *PriceTree {
	return &PriceTree{
		tree: treemap.NewWith[string, *PriceLevel](utils.Comparator[string](decimalComparator)),
	}
}

// NewAskTree creates a price tree for asks (use Min() for best ask).
func NewAskTree() *PriceTree {
	return &PriceTree{
		tree: treemap.NewWith[string, *PriceLevel](utils.Comparator[string](decimalComparator)),
	}
}

// Put adds or updates a price level.
func (t *PriceTree) Put(price decimal.Decimal, level *PriceLevel) {
	t.tree.Put(price.String(), level)
}

// Get returns the price level at the given price, or nil if not found.
func (t *PriceTree) Get(price decimal.Decimal) (*PriceLevel, bool) {
	level, found := t.tree.Get(price.String())
	return level, found
}

// Remove removes the price level at the given price.
func (t *PriceTree) Remove(price decimal.Decimal) {
	t.tree.Remove(price.String())
}

// Best returns the best price level for bids (Max) or asks (Min).
// For bids (descending): best = highest = Max.
// For asks (ascending): best = lowest = Min.
func (t *PriceTree) BestBid() (decimal.Decimal, *PriceLevel, bool) {
	key, value, ok := t.tree.Max()
	if !ok {
		return decimal.Zero, nil, false
	}
	price, _ := decimal.NewFromString(key)
	return price, value, true
}

func (t *PriceTree) BestAsk() (decimal.Decimal, *PriceLevel, bool) {
	key, value, ok := t.tree.Min()
	if !ok {
		return decimal.Zero, nil, false
	}
	price, _ := decimal.NewFromString(key)
	return price, value, true
}

// Empty returns true if the tree has no levels.
func (t *PriceTree) Empty() bool {
	return t.tree.Empty()
}
