# 🧩 v0.1 — Phase 6: Edge Safety

---

# 1️⃣ Objective

Add validation and invariant protection so the engine cannot produce invalid order book states.

The engine must reject:

* zero quantity orders
* negative quantities
* negative prices

And must guarantee internal invariants like:

```
0 ≤ remaining ≤ quantity
```

This phase protects the matching engine from corrupted state.

---

# 2️⃣ Concepts Introduced

* Engine-level validation
* Domain invariants
* Defensive programming
* Order book cleanup guarantees

Important principle:

> The engine should never silently accept invalid input.

We are NOT introducing:

* API validation
* database constraints
* external error handling

This validation exists **inside the engine itself**.

---

# 3️⃣ Checklist

### Input Validation

* [ ] Reject order with quantity = 0
* [ ] Reject order with quantity < 0
* [ ] Reject order with price ≤ 0

### Order State Safety

* [ ] `remaining` never exceeds `quantity`
* [ ] `remaining` never becomes negative
* [ ] No trades with quantity 0

### Order Book Cleanup

* [ ] Empty price levels removed
* [ ] Empty levels removed from price arrays
* [ ] No orphan price levels

### Defensive Guards

* [ ] Matching loop stops if taker.remaining == 0
* [ ] Matching loop stops if no price crossing
* [ ] Engine never produces NaN values

---

# 4️⃣ Test Cases (Phase Completion Gate)

Phase is DONE when all pass.

---

### ✅ Test 1 — Reject Zero Quantity

Scenario:

```
BUY 0 @ 100
```

Expected:

Engine rejects order.

Orderbook unchanged.

---

### ✅ Test 2 — Reject Negative Quantity

Scenario:

```
SELL -5 @ 100
```

Expected:

Engine throws validation error.

No order inserted.

---

### ✅ Test 3 — Reject Negative Price

Scenario:

```
BUY 5 @ -100
```

Expected:

Engine rejects order.

---

### ✅ Test 4 — Remaining Never Exceeds Quantity

Scenario:

```
SELL 10 @ 100
BUY 7 @ 100
```

Expected:

```
SELL.remaining = 3
```

Invariant holds:

```
remaining ≤ quantity
```

---

### ✅ Test 5 — Empty Level Removed

Scenario:

```
SELL 5 @ 100
BUY 5 @ 100
```

Expected:

* Price level removed
* Price removed from sorted arrays
* Orderbook empty

---

### ✅ Test 6 — No Zero Trade Events

Engine must never emit:

```
TradeExecuted quantity = 0
```

---

# 5️⃣ Step-by-step Guide

---

## Step 1 — Add Order Validation

Inside `process(command)` before matching:

Example:

```ts
if (order.quantity <= 0) throw new Error("Invalid quantity")
if (order.price <= 0) throw new Error("Invalid price")
```

Simple is fine.

---

## Step 2 — Guard Trade Quantity

Ensure trade size is always valid:

```
tradeQty = min(taker.remaining, maker.remaining)
```

Then assert:

```
tradeQty > 0
```

---

## Step 3 — Enforce Remaining Invariant

After every match:

```
maker.remaining -= tradeQty
taker.remaining -= tradeQty
```

Add defensive check:

```
if (maker.remaining < 0) throw
if (taker.remaining < 0) throw
```

These should never trigger if logic is correct.

---

## Step 4 — Remove Empty Levels Safely

When level.orders becomes empty:

1. Remove level from map
2. Remove price from sorted price array

Example logic:

```
if level.orders.length == 0
  delete priceLevel
  remove price from sorted list
```

---

## Step 5 — Prevent Infinite Matching Loops

Matching loop condition must always be:

```
while (taker.remaining > 0 && bestPriceCrossing)
```

Never run without both guards.

---

# ⚠️ Common Mistakes

Avoid:

❌ Allowing zero quantity orders
❌ Allowing negative price
❌ Forgetting to clean empty price levels
❌ Allowing tradeQty = 0
❌ Letting remaining become negative

These break invariants.

---

# 📌 Phase 6 Boundary Reminder

After this phase the engine is:

✔ Deterministic
✔ Price-time priority
✔ Multi-level matching
✔ Partial fills
✔ Deterministic trade IDs
✔ Input validation
✔ Invariant safe