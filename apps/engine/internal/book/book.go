package book

import (
	"sync"

	"github.com/shopspring/decimal"

	"helix-exchange/engine/internal/domain"
)

// OrderBook maintains bids and asks per market with price-time priority.
type OrderBook struct {
	MarketID      string // subject token e.g. ACME_USD
	MarketUUID    string // UUID from API, for trade/event payloads
	Bids          *PriceTree
	Asks          *PriceTree
	seq           uint64
	orderIndex    map[string]*orderLocation // orderID -> location for O(1) cancel
	mu            sync.Mutex
}

// orderLocation points to an order's price level for fast cancellation.
type orderLocation struct {
	price decimal.Decimal
	side  domain.OrderSide
}

// NewOrderBook creates an empty order book for a market.
func NewOrderBook(marketSubject string) *OrderBook {
	return &OrderBook{
		MarketID:   marketSubject,
		Bids:       NewBidTree(),
		Asks:       NewAskTree(),
		orderIndex: make(map[string]*orderLocation),
	}
}

// SetMarketUUID sets the market UUID from API (for trade payloads). Idempotent.
func (b *OrderBook) SetMarketUUID(uuid string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.MarketUUID == "" {
		b.MarketUUID = uuid
	}
}

// BestBid returns the best bid price and level, or false if empty.
func (b *OrderBook) BestBid() (decimal.Decimal, *PriceLevel, bool) {
	return b.Bids.BestBid()
}

// BestAsk returns the best ask price and level, or false if empty.
func (b *OrderBook) BestAsk() (decimal.Decimal, *PriceLevel, bool) {
	return b.Asks.BestAsk()
}

// NextSequence returns and increments the per-market sequence.
func (b *OrderBook) NextSequence() uint64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.seq++
	return b.seq
}

// AddLimitOrder adds a limit order to the book. Call after matching.
func (b *OrderBook) AddLimitOrder(o *domain.Order) {
	b.mu.Lock()
	defer b.mu.Unlock()

	price := o.Price
	loc := &orderLocation{price: price, side: o.Side}
	b.orderIndex[o.ID] = loc

	if o.Side == domain.OrderSideBuy {
		if level, found := b.Bids.Get(price); found {
			level.Orders.Enqueue(o)
		} else {
			b.Bids.Put(price, NewPriceLevel(price, o))
		}
	} else {
		if level, found := b.Asks.Get(price); found {
			level.Orders.Enqueue(o)
		} else {
			b.Asks.Put(price, NewPriceLevel(price, o))
		}
	}
}

// removeOrderFromLevel removes an order from a level's queue by rebuilding without it.
// Returns the order if found. O(n) in level depth.
func removeOrderFromLevel(level *PriceLevel, orderID string) *domain.Order {
	var found *domain.Order
	temp := make([]*domain.Order, 0, level.Orders.Len())
	for !level.Orders.IsEmpty() {
		o := level.Orders.Dequeue()
		if o.ID == orderID {
			found = o
		} else {
			temp = append(temp, o)
		}
	}
	for _, o := range temp {
		level.Orders.Enqueue(o)
	}
	return found
}

// CancelOrder removes an order from the book by ID. Returns the order if found.
func (b *OrderBook) CancelOrder(orderID string) (*domain.Order, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	loc, ok := b.orderIndex[orderID]
	if !ok {
		return nil, false
	}
	delete(b.orderIndex, orderID)

	var found *domain.Order
	if loc.side == domain.OrderSideBuy {
		if level, ok := b.Bids.Get(loc.price); ok {
			found = removeOrderFromLevel(level, orderID)
			if level.Orders.IsEmpty() {
				b.Bids.Remove(loc.price)
			}
		}
	} else {
		if level, ok := b.Asks.Get(loc.price); ok {
			found = removeOrderFromLevel(level, orderID)
			if level.Orders.IsEmpty() {
				b.Asks.Remove(loc.price)
			}
		}
	}
	return found, found != nil
}

// RemoveFromIndex removes an order from the cancel index. Call when order is filled and dequeued.
func (b *OrderBook) RemoveFromIndex(orderID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.orderIndex, orderID)
}
