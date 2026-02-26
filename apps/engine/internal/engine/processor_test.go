package engine

import (
	"encoding/json"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"helix-exchange/engine/internal/domain"
	"helix-exchange/engine/internal/events"
)

// mockPublisher captures published events for assertions.
type mockPublisher struct {
	trades      []*domain.Trade
	orderEvents []orderEvent
}

type orderEvent struct {
	order     *domain.Order
	eventType string
}

func (m *mockPublisher) PublishTrade(marketSubject string, t *domain.Trade) error {
	m.trades = append(m.trades, t)
	return nil
}

func (m *mockPublisher) PublishOrderEvent(marketSubject string, o *domain.Order, eventType string) error {
	m.orderEvents = append(m.orderEvents, orderEvent{order: o, eventType: eventType})
	return nil
}

var _ events.EventPublisher = (*mockPublisher)(nil)

func TestProcessCommand_OrderAccepted_PlacesRestingOrder(t *testing.T) {
	pub := &mockPublisher{}
	proc := NewProcessor(pub)

	payload := `{"eventType":"created","orderId":"ord-1","userId":"u1","marketId":"m1","side":"BUY","type":"LIMIT","price":"100.50","quantity":"10","remainingQuantity":"10","status":"NEW","createdAt":"2024-01-01T00:00:00Z"}`
	err := proc.ProcessCommand("ACME_USD", []byte(payload))
	require.NoError(t, err)

	// Empty book: limit buy rests, no trades
	assert.Empty(t, pub.trades)
	assert.Empty(t, pub.orderEvents)
}

func TestProcessCommand_OrderAccepted_MatchesAndFills(t *testing.T) {
	pub := &mockPublisher{}
	proc := NewProcessor(pub)

	// First order: sell 5 at 100 (rests)
	sellPayload := `{"eventType":"created","orderId":"sell-1","userId":"u2","marketId":"m1","side":"SELL","type":"LIMIT","price":"100","quantity":"5","remainingQuantity":"5","status":"NEW","createdAt":"2024-01-01T00:00:00Z"}`
	err := proc.ProcessCommand("ACME_USD", []byte(sellPayload))
	require.NoError(t, err)
	assert.Empty(t, pub.trades)

	// Second order: buy 3 at 100 (matches)
	buyPayload := `{"eventType":"created","orderId":"buy-1","userId":"u1","marketId":"m1","side":"BUY","type":"LIMIT","price":"100","quantity":"3","remainingQuantity":"3","status":"NEW","createdAt":"2024-01-01T00:00:00Z"}`
	err = proc.ProcessCommand("ACME_USD", []byte(buyPayload))
	require.NoError(t, err)

	require.Len(t, pub.trades, 1)
	assert.True(t, pub.trades[0].Quantity.Equal(decimal.NewFromInt(3)))
	assert.True(t, pub.trades[0].Price.Equal(decimal.NewFromInt(100)))
	assert.Equal(t, "buy-1", pub.trades[0].BuyOrderID)
	assert.Equal(t, "sell-1", pub.trades[0].SellOrderID)
	require.Len(t, pub.orderEvents, 2) // OrderFilled for buy, OrderPartiallyFilled for sell
}

func TestProcessCommand_DuplicateOrderAccepted_Ignored(t *testing.T) {
	pub := &mockPublisher{}
	proc := NewProcessor(pub)

	payload := `{"eventType":"created","orderId":"ord-1","userId":"u1","marketId":"m1","side":"BUY","type":"LIMIT","price":"100","quantity":"10","remainingQuantity":"10","status":"NEW","createdAt":"2024-01-01T00:00:00Z"}`
	err := proc.ProcessCommand("ACME_USD", []byte(payload))
	require.NoError(t, err)

	// Duplicate: should be ignored
	err = proc.ProcessCommand("ACME_USD", []byte(payload))
	require.NoError(t, err)

	// Only first order processed (resting), no trades
	assert.Empty(t, pub.trades)
	assert.Empty(t, pub.orderEvents)
}

func TestProcessCommand_ParseOrderAccepted(t *testing.T) {
	payload := `{"eventType":"created","orderId":"ord-1","userId":"u1","marketId":"m1","side":"BUY","type":"LIMIT","price":"100.50","quantity":"10","remainingQuantity":"10","status":"NEW","createdAt":"2024-01-01T00:00:00Z"}`
	var cmd OrderAcceptedCommand
	err := json.Unmarshal([]byte(payload), &cmd)
	require.NoError(t, err)
	assert.Equal(t, "created", cmd.EventType)
	assert.Equal(t, "ord-1", cmd.OrderID)
	assert.Equal(t, "BUY", cmd.Side)
	assert.Equal(t, "LIMIT", cmd.Type)
	assert.NotNil(t, cmd.Price)
	assert.Equal(t, "100.50", *cmd.Price)
	assert.Equal(t, "10", cmd.Quantity)
}
