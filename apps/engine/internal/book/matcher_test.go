package book

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"helix-exchange/engine/internal/domain"
)

func TestMatch_LimitBuy_EmptyBook(t *testing.T) {
	ob := NewOrderBook("ACME_USD")
	ob.SetMarketUUID("market-uuid")

	price := decimal.NewFromInt(100)
	qty := decimal.NewFromInt(10)
	o := domain.NewOrder("ord1", "u1", "market-uuid", domain.OrderSideBuy, domain.OrderTypeLimit, price, qty, 1)

	result := Match(ob, &o)

	assert.Empty(t, result.Trades)
	assert.Empty(t, result.OrderUpdates)
	assert.Empty(t, result.CancelledOrders)
	require.NotNil(t, result.RestingOrder)
	assert.Equal(t, "ord1", result.RestingOrder.ID)
	assert.True(t, result.RestingOrder.RemainingQuantity.Equal(qty))

	ob.AddLimitOrder(result.RestingOrder)
	bestBid, _, ok := ob.BestBid()
	assert.True(t, ok)
	assert.True(t, bestBid.Equal(price))
}

func TestMatch_LimitBuy_CrossesSpread(t *testing.T) {
	ob := NewOrderBook("ACME_USD")
	ob.SetMarketUUID("market-uuid")

	// Resting sell at 100
	sellPrice := decimal.NewFromInt(100)
	sell := domain.NewOrder("sell1", "u2", "market-uuid", domain.OrderSideSell, domain.OrderTypeLimit, sellPrice, decimal.NewFromInt(5), 1)
	ob.AddLimitOrder(&sell)

	// Incoming buy at 100 (matches)
	buy := domain.NewOrder("buy1", "u1", "market-uuid", domain.OrderSideBuy, domain.OrderTypeLimit, sellPrice, decimal.NewFromInt(3), 2)
	result := Match(ob, &buy)

	require.Len(t, result.Trades, 1)
	assert.True(t, result.Trades[0].Price.Equal(sellPrice))
	assert.True(t, result.Trades[0].Quantity.Equal(decimal.NewFromInt(3)))
	assert.Equal(t, "buy1", result.Trades[0].BuyOrderID)
	assert.Equal(t, "sell1", result.Trades[0].SellOrderID)

	require.Len(t, result.OrderUpdates, 2) // buy filled, sell partially filled
	assert.Nil(t, result.RestingOrder)
	assert.Empty(t, result.CancelledOrders)

	// Sell should have 2 remaining, still in book (we mutate in place, only dequeue when filled)
	bestAsk, level, ok := ob.BestAsk()
	assert.True(t, ok)
	assert.True(t, bestAsk.Equal(sellPrice))
	assert.Equal(t, 1, level.Orders.Len())
	restingOrder := level.Orders.Peek()
	assert.True(t, restingOrder.RemainingQuantity.Equal(decimal.NewFromInt(2)))
}

func TestMatch_LimitBuy_NoCross(t *testing.T) {
	ob := NewOrderBook("ACME_USD")
	ob.SetMarketUUID("market-uuid")

	// Resting sell at 101
	sell := domain.NewOrder("sell1", "u2", "market-uuid", domain.OrderSideSell, domain.OrderTypeLimit, decimal.NewFromInt(101), decimal.NewFromInt(5), 1)
	ob.AddLimitOrder(&sell)

	// Incoming buy at 100 (does not cross)
	buy := domain.NewOrder("buy1", "u1", "market-uuid", domain.OrderSideBuy, domain.OrderTypeLimit, decimal.NewFromInt(100), decimal.NewFromInt(3), 2)
	result := Match(ob, &buy)

	assert.Empty(t, result.Trades)
	require.NotNil(t, result.RestingOrder)
	assert.Equal(t, "buy1", result.RestingOrder.ID)
}

func TestMatch_MarketBuy_EmptyBook(t *testing.T) {
	ob := NewOrderBook("ACME_USD")
	ob.SetMarketUUID("market-uuid")

	buy := domain.NewOrder("buy1", "u1", "market-uuid", domain.OrderSideBuy, domain.OrderTypeMarket, decimal.Zero, decimal.NewFromInt(10), 1)
	result := Match(ob, &buy)

	assert.Empty(t, result.Trades)
	assert.Empty(t, result.OrderUpdates)
	require.Len(t, result.CancelledOrders, 1)
	assert.Equal(t, "buy1", result.CancelledOrders[0].ID)
	assert.Nil(t, result.RestingOrder)
}

func TestMatch_MarketBuy_Fills(t *testing.T) {
	ob := NewOrderBook("ACME_USD")
	ob.SetMarketUUID("market-uuid")

	sell := domain.NewOrder("sell1", "u2", "market-uuid", domain.OrderSideSell, domain.OrderTypeLimit, decimal.NewFromInt(99), decimal.NewFromInt(5), 1)
	ob.AddLimitOrder(&sell)

	buy := domain.NewOrder("buy1", "u1", "market-uuid", domain.OrderSideBuy, domain.OrderTypeMarket, decimal.Zero, decimal.NewFromInt(3), 2)
	result := Match(ob, &buy)

	require.Len(t, result.Trades, 1)
	assert.True(t, result.Trades[0].Quantity.Equal(decimal.NewFromInt(3)))
	assert.True(t, result.Trades[0].Price.Equal(decimal.NewFromInt(99)))
	assert.Nil(t, result.RestingOrder)
	assert.Empty(t, result.CancelledOrders)
}

func TestMatch_PartialFill(t *testing.T) {
	ob := NewOrderBook("ACME_USD")
	ob.SetMarketUUID("market-uuid")

	// Sell 2 at 100
	sell := domain.NewOrder("sell1", "u2", "market-uuid", domain.OrderSideSell, domain.OrderTypeLimit, decimal.NewFromInt(100), decimal.NewFromInt(2), 1)
	ob.AddLimitOrder(&sell)

	// Buy 5 at 100 - fills 2, rests 3
	buy := domain.NewOrder("buy1", "u1", "market-uuid", domain.OrderSideBuy, domain.OrderTypeLimit, decimal.NewFromInt(100), decimal.NewFromInt(5), 2)
	result := Match(ob, &buy)

	require.Len(t, result.Trades, 1)
	assert.True(t, result.Trades[0].Quantity.Equal(decimal.NewFromInt(2)))
	require.NotNil(t, result.RestingOrder)
	assert.True(t, result.RestingOrder.RemainingQuantity.Equal(decimal.NewFromInt(3)))
	assert.Equal(t, domain.OrderStatusPartiallyFilled, result.RestingOrder.Status)
}

func TestMatch_CancelOrder(t *testing.T) {
	ob := NewOrderBook("ACME_USD")
	ob.SetMarketUUID("market-uuid")

	sell := domain.NewOrder("sell1", "u2", "market-uuid", domain.OrderSideSell, domain.OrderTypeLimit, decimal.NewFromInt(100), decimal.NewFromInt(5), 1)
	ob.AddLimitOrder(&sell)

	o, found := ob.CancelOrder("sell1")
	require.True(t, found)
	require.NotNil(t, o)
	assert.Equal(t, "sell1", o.ID)

	_, _, ok := ob.BestAsk()
	assert.False(t, ok)

	_, found = ob.CancelOrder("sell1")
	assert.False(t, found)
}
