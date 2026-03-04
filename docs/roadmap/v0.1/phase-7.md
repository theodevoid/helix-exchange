# 🧩 v0.1 — Phase 7: Multi-Market Manager

---

# 1️⃣ Objective

Introduce a **market routing layer** that manages multiple independent matching engines.

Each market must have:

* Its own order book
* Its own trade sequence
* Its own deterministic state

No market may share mutable state with another.

The new component will route commands like:

```
PlaceLimitOrder(marketId)
```

to the correct engine instance.

---

# 2️⃣ Concepts Introduced

* Engine orchestration
* Market isolation
* Command routing
* Per-market deterministic state

This mirrors how real exchanges structure matching systems:

```
Market Router
   ├── BTC-USDT Engine
   ├── ETH-USDT Engine
   ├── SOL-USDT Engine
```

Each market behaves like an independent matching machine.

We are NOT introducing:

* parallelism
* distributed matching
* persistence

Everything remains in-memory.

---

# 3️⃣ Checklist

### Market Router

* [ ] Create `MatchingEngineManager`
* [ ] Maintain `Map<marketId, MatchingEngine>`
* [ ] Route commands by `marketId`

### Engine Creation

* [ ] New engine created automatically when first order arrives
* [ ] Engine initialized with correct marketId

### Market Isolation

* [ ] Trade sequences independent per market
* [ ] Orderbooks independent
* [ ] Matching logic unaffected by other markets

### API Surface

* [ ] Manager exposes `process(command)`
* [ ] Manager returns aggregated `EngineEvent[]`

---

# 4️⃣ Test Cases (Phase Completion Gate)

Phase is DONE when all pass.

---

### ✅ Test 1 — Two Markets Independent

Scenario:

```
BTC-USDT
SELL 5 @ 100
BUY 5 @ 100
```

and

```
ETH-USDT
SELL 3 @ 200
BUY 3 @ 200
```

Expected:

Trades:

```
BTC-USDT-1
ETH-USDT-1
```

Sequences are independent.

---

### ✅ Test 2 — Orderbooks Are Separate

Scenario:

```
BTC-USDT SELL 5 @ 100
ETH-USDT SELL 5 @ 100
```

Expected:

Each market has its own orderbook.

No cross interaction.

---

### ✅ Test 3 — Cross-Market Matching Never Happens

Scenario:

```
BTC-USDT SELL 5 @ 100
ETH-USDT BUY 5 @ 100
```

Expected:

No trade.

Markets do not interact.

---

### ✅ Test 4 — Engine Auto-Creation

Scenario:

First order arrives for:

```
SOL-USDT
```

Expected:

Manager creates new engine instance automatically.

---

# 5️⃣ Step-by-step Guide

---

## Step 1 — Create Manager Class

Example:

```ts
class MatchingEngineManager {
  private engines: Map<string, MatchingEngine> = new Map()
}
```

Key is `marketId`.

---

## Step 2 — Add Engine Getter

Create helper:

```ts
private getEngine(marketId: string): MatchingEngine
```

Logic:

```
if engine not exists
   create engine
return engine
```

---

## Step 3 — Route Commands

Manager exposes:

```ts
process(command: PlaceLimitOrder): EngineEvent[]
```

Inside:

```
engine = getEngine(command.marketId)
return engine.process(command)
```

Manager itself contains **no matching logic**.

It only routes.

---

## Step 4 — Ensure Engine Receives marketId

Each `MatchingEngine` must store:

```
marketId
```

This ensures trade IDs remain:

```
${marketId}-${sequence}
```

---

## Step 5 — Validate Determinism

Replay identical event stream across markets.

Example:

```
BTC BUY
BTC SELL
ETH BUY
ETH SELL
```

Trade sequences must remain:

```
BTC-USDT-1
ETH-USDT-1
```

No cross contamination.

---

# ⚠️ Common Mistakes

Avoid:

❌ Sharing one engine across all markets
❌ Using global trade sequence
❌ Mixing orderbooks between markets
❌ Letting manager contain matching logic

Manager = router only.

---

# 📌 Phase 7 Boundary Reminder

After this phase the engine now supports:

✔ Deterministic matching
✔ Multi-level orderbooks
✔ FIFO time priority
✔ Deterministic trade IDs
✔ Input validation
✔ Multi-market routing

That completes **Version v0.1**.

You now have a **fully deterministic, multi-market matching engine core**.

---

# 🏁 v0.1 Status

Engine capabilities now include:

```
LIMIT orders
Price-time priority
Partial fills
Multi-level matching
Deterministic trade IDs
Invariant safety
Multi-market routing
```

Still intentionally missing:

```
Cancel orders
Market orders
Persistence
Ledger
Balances
Event bus
```