package book

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"helix-exchange/engine/internal/domain"
)

func TestFIFOQueue(t *testing.T) {
	q := NewFIFOQueue()
	assert.True(t, q.IsEmpty())
	assert.Equal(t, 0, q.Len())
	assert.Nil(t, q.Peek())
	assert.Nil(t, q.Dequeue())

	o1 := domain.NewOrder("1", "u1", "m1", domain.OrderSideBuy, domain.OrderTypeLimit, decimal.NewFromInt(100), decimal.NewFromInt(1), 1)
	o2 := domain.NewOrder("2", "u2", "m1", domain.OrderSideSell, domain.OrderTypeLimit, decimal.NewFromInt(101), decimal.NewFromInt(1), 2)

	q.Enqueue(&o1)
	assert.False(t, q.IsEmpty())
	assert.Equal(t, 1, q.Len())
	assert.Equal(t, "1", q.Peek().ID)

	q.Enqueue(&o2)
	assert.Equal(t, 2, q.Len())

	out := q.Dequeue()
	require.NotNil(t, out)
	assert.Equal(t, "1", out.ID)
	assert.Equal(t, 1, q.Len())

	out = q.Dequeue()
	require.NotNil(t, out)
	assert.Equal(t, "2", out.ID)
	assert.True(t, q.IsEmpty())
	assert.Nil(t, q.Dequeue())
}
