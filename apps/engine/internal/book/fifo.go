package book

import "helix-exchange/engine/internal/domain"

// FIFOQueue is an O(1) enqueue/dequeue queue for orders at a price level.
// Uses a slice with head index for amortized O(1) operations.
type FIFOQueue struct {
	orders []*domain.Order
	head   int
}

// NewFIFOQueue creates an empty FIFO queue.
func NewFIFOQueue() *FIFOQueue {
	return &FIFOQueue{
		orders: make([]*domain.Order, 0, 8),
		head:   0,
	}
}

// Enqueue adds an order to the back. O(1) amortized.
func (q *FIFOQueue) Enqueue(o *domain.Order) {
	q.orders = append(q.orders, o)
}

// Dequeue removes and returns the front order, or nil if empty. O(1).
func (q *FIFOQueue) Dequeue() *domain.Order {
	if q.IsEmpty() {
		return nil
	}
	o := q.orders[q.head]
	q.head++
	if q.head >= len(q.orders)/2 {
		q.orders = q.orders[q.head:]
		q.head = 0
	}
	return o
}

// Peek returns the front order without removing. O(1).
func (q *FIFOQueue) Peek() *domain.Order {
	if q.IsEmpty() {
		return nil
	}
	return q.orders[q.head]
}

// Len returns the number of orders. O(1).
func (q *FIFOQueue) Len() int {
	return len(q.orders) - q.head
}

// IsEmpty returns true if the queue has no orders.
func (q *FIFOQueue) IsEmpty() bool {
	return q.Len() == 0
}
