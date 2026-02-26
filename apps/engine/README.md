# Helix Exchange

# Go Matching Engine

Deterministic, in-memory execution engine for Helix Exchange.

---

# Overview

The Go Matching Engine is the execution core of Helix Exchange.

It is responsible for:

* Maintaining the in-memory order book per market
* Applying price-time priority matching
* Emitting trade and order state events
* Supporting deterministic replay

It is **execution-only**.

It does NOT:

* Access PostgreSQL
* Validate balances
* Perform risk checks
* Persist trades
* Update ledger
* Handle HTTP

---

# Architecture Philosophy

The engine is built around four principles:

1. **Determinism** – Same inputs → same outputs
2. **Isolation** – Per-market sequential processing
3. **Replayability** – State rebuildable from command stream
4. **Single Responsibility** – Execution logic only

---

# High-Level Flow

```
orders.commands.{market}
        ↓
Matching Engine (in-memory order book)
        ↓
trades.events.{market}
orders.events.{market}
```

---

# Tech Stack

* **Language**: Go 1.22+
* **Event Bus**: NATS JetStream
* **Decimal Library**: shopspring/decimal
* **Logging**: zerolog
* **Concurrency Model**: Single goroutine per market
* **Testing**: Go test with `-race`

No ORM.
No database driver.
No HTTP framework.

---

# Directory Structure

```
/cmd/engine/main.go
/internal
  /app
  /domain
  /book
  /events
  /config
```

---

# Core Responsibilities

## 1. Command Consumption

Subscribes to:

```
orders.commands.{market}
```

Supported command types:

* OrderAccepted
* OrderCancelled

---

## 2. Order Book Management

Each market maintains:

* Bids (sorted descending)
* Asks (sorted ascending)
* FIFO queue per price level

### Data Structures

```go
type OrderBook struct {
    Bids *PriceTree
    Asks *PriceTree
}
```

Price level:

```go
type PriceLevel struct {
    Price  decimal.Decimal
    Orders *FIFOQueue
}
```

No map iteration allowed for priority logic.

---

## 3. Matching Logic

### Price-Time Priority

1. Better price first
2. Earlier order first

### LIMIT Orders

BUY matches while:

* remaining > 0
* bestAsk ≤ buyPrice

SELL matches while:

* remaining > 0
* bestBid ≥ sellPrice

Trade price = resting order price.

---

### MARKET Orders

* Ignore price constraint
* Consume book until:

  * quantity filled
  * book empty
* Remaining quantity cancelled if unfilled

---

## 4. Event Emission

Publishes to:

```
trades.events.{market}
orders.events.{market}
```

Emits:

* TradeExecuted
* OrderFilled
* OrderPartiallyFilled
* OrderCancelled

Engine never updates persistence.

---

# Determinism Guarantees

The engine guarantees:

* Sequential command processing
* No concurrent book mutation
* No floating point arithmetic
* No nondeterministic iteration
* Stable FIFO ordering

Given identical command stream:

Trade sequence must be identical.

---

# Concurrency Model

One goroutine per market.

```
for msg := range subscription {
    processCommand(msg)
}
```

No parallel execution inside loop.

Markets scale horizontally across instances.

---

# Crash Recovery

Engine state is not persisted.

Recovery process:

1. Restart engine
2. Replay `orders.commands.{market}`
3. Rebuild in-memory book
4. Resume live processing

Financial correctness remains intact because ledger lives outside engine.

---

# Failure Handling

## Duplicate Commands

Engine must tolerate duplicate OrderAccepted.

Downstream handlers must be idempotent.

---

## Publish Failure

If event publish fails:

* Do not ack command
* Retry publish
* Ensure eventual delivery

---

# Performance Targets (v1)

* < 100µs per match
* O(log N) price insertion
* O(1) FIFO dequeue
* Minimal GC pressure

---

# Observability

Expose metrics:

* orders_processed_total
* trades_executed_total
* match_latency_ms
* replay_duration
* orderbook_depth

Structured logs required.

---

# Security & Safety Rules

Engine must:

* Reject invalid quantities
* Reject invalid prices
* Prevent negative remaining quantities
* Prevent precision drift
* Avoid integer overflow

---

# Strict Boundaries

The engine must NEVER:

* Connect to Postgres
* Update balances
* Insert ledger entries
* Perform risk checks
* Depend on HTTP layer

If you see DB calls in this service, something is wrong.

---

# Invariants

At all times:

* No order has negative remaining quantity
* No crossed book after matching
* Sum of matched quantities equals trade quantity
* FIFO ordering preserved within price level

---

# Scaling Strategy

Scale across markets.

Example:

* Engine Instance A → ACME/USD
* Engine Instance B → BTC/USD

Never parallelize a single market.

Determinism > concurrency.

---

# Non-Goals (v1)

* Margin trading
* Liquidation engine
* Advanced order types
* Snapshot persistence
* Cross-market netting

---

# Definition of Correctness

The engine is correct when:

* Replay produces identical trades
* Price-time priority holds
* No race conditions detected
* All unit tests pass
* No floating-point arithmetic exists

---

# Mental Model

The Matching Engine is:

> A deterministic function over an ordered stream of order commands.

It knows nothing about money.
It knows nothing about users.
It only knows about price-time priority.

Everything else belongs to other services.
