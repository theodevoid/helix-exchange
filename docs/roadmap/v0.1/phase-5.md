# 🧩 v0.1 — Phase 5: Deterministic Trade Sequence

---

# 1️⃣ Objective

Introduce a **deterministic trade ID generator** so that:

* Trade IDs are predictable
* Replaying the same command stream produces identical trade IDs
* Each market maintains its own independent trade sequence

Trade IDs must follow:

```
${marketId}-${sequence}
```

Example:

```
BTC-USDT-1
BTC-USDT-2
BTC-USDT-3
```

The sequence must increment **only when a trade occurs**.

---

# 2️⃣ Concepts Introduced

* Deterministic state progression
* Per-market sequence counters
* Replay safety
* Engine state minimalism

This phase introduces **the first internal mutable engine state outside the orderbook**.

We are NOT introducing:

* Persistence
* Event sourcing
* Snapshotting
* External ID generators

Everything remains in-memory.

---

# 3️⃣ Checklist

### Sequence Generator

* [ ] Each market has its own sequence counter
* [ ] Counter starts at `1`
* [ ] Increment occurs **only when trade is created**
* [ ] Sequence never skips numbers

### Trade ID Format

* [ ] Trade ID format: `${marketId}-${sequence}`
* [ ] Deterministic formatting
* [ ] No timestamps
* [ ] No randomness

### Engine State

* [ ] Sequence counter stored in engine instance
* [ ] Counter resets on engine restart
* [ ] No shared counters between markets

---

# 4️⃣ Test Cases (Phase Completion Gate)

Phase is DONE when all pass.

---

### ✅ Test 1 — Sequential Trades

Scenario:

SELL 5 @ 100
BUY 5 @ 100

Expected trade:

```
BTC-USDT-1
```

Next trade:

```
BTC-USDT-2
```

Sequence increments strictly.

---

### ✅ Test 2 — Multi-Level Trades Generate Multiple IDs

Scenario:

SELL 5 @ 100
SELL 5 @ 110
BUY 10 @ 120

Expected:

```
BTC-USDT-1
BTC-USDT-2
```

One trade per match.

---

### ✅ Test 3 — Deterministic Replay

Given identical order sequence:

```
OrderPlaced A
OrderPlaced B
OrderPlaced C
```

Run engine twice.

Expected:

Trade IDs identical both runs.

---

### ✅ Test 4 — Separate Market Sequences

Scenario:

Market: BTC-USDT

```
BTC-USDT-1
BTC-USDT-2
```

Market: ETH-USDT

```
ETH-USDT-1
ETH-USDT-2
```

Sequences must be independent.

---

# 5️⃣ Step-by-step Guide

---

## Step 1 — Add Trade Sequence State

Inside `MatchingEngine`:

```ts
private tradeSequence: number = 1
```

This belongs to the **market engine instance**, not the orderbook.

---

## Step 2 — Create Trade ID Function

Example:

```ts
private nextTradeId(): string {
  const id = `${this.marketId}-${this.tradeSequence}`
  this.tradeSequence++
  return id
}
```

Important rule:

> Increment after generating ID.

---

## Step 3 — Attach Trade ID to TradeExecuted Event

Inside matching logic:

```ts
const tradeId = this.nextTradeId()
```

Then emit:

```
TradeExecuted
```

with:

```
tradeId
price
quantity
makerOrderId
takerOrderId
```

---

## Step 4 — Ensure No ID Generation Without Trade

Trade ID should **only be generated when a trade occurs**.

Do NOT generate during:

* Order placement
* Order resting
* Book insertion

Only inside match logic.

---

## Step 5 — Verify Replay Determinism

Run identical command stream twice.

Example:

```
Place SELL
Place BUY
```

Both runs must produce:

```
BTC-USDT-1
```

Not:

```
BTC-USDT-1
BTC-USDT-3
```

No gaps allowed.

---

# ⚠️ Common Mistakes

Avoid:

❌ Using timestamps in trade ID
❌ Using random UUIDs
❌ Incrementing sequence when order placed
❌ Sharing counter across markets

Those break determinism.

---

# 📌 Phase 5 Boundary Reminder

At this point, the engine now supports:

✔ Multi-level matching
✔ FIFO time priority
✔ Partial fills
✔ Deterministic traversal
✔ Deterministic trade IDs

This is now a **fully deterministic matching engine core**.
