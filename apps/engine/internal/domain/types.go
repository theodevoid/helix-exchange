package domain

// OrderSide represents the side of an order in the book.
type OrderSide int

const (
	OrderSideBuy OrderSide = iota
	OrderSideSell
)

func (s OrderSide) String() string {
	switch s {
	case OrderSideBuy:
		return "BUY"
	case OrderSideSell:
		return "SELL"
	default:
		return "UNKNOWN"
	}
}

// OrderType represents the type of order (limit vs market).
type OrderType int

const (
	OrderTypeLimit OrderType = iota
	OrderTypeMarket
)

func (t OrderType) String() string {
	switch t {
	case OrderTypeLimit:
		return "LIMIT"
	case OrderTypeMarket:
		return "MARKET"
	default:
		return "UNKNOWN"
	}
}

// OrderStatus represents the lifecycle state of an order.
type OrderStatus int

const (
	OrderStatusNew OrderStatus = iota
	OrderStatusOpen
	OrderStatusPartiallyFilled
	OrderStatusFilled
	OrderStatusCancelled
	OrderStatusRejected
)

func (s OrderStatus) String() string {
	switch s {
	case OrderStatusNew:
		return "NEW"
	case OrderStatusOpen:
		return "OPEN"
	case OrderStatusPartiallyFilled:
		return "PARTIALLY_FILLED"
	case OrderStatusFilled:
		return "FILLED"
	case OrderStatusCancelled:
		return "CANCELLED"
	case OrderStatusRejected:
		return "REJECTED"
	default:
		return "UNKNOWN"
	}
}
