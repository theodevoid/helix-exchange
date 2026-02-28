# 🧩 v0.1 — Phase 2: Partial Fill (Single Price Level)

---

## 1️⃣ Objective

Extend the engine to support **partial fills at a single price level**, while preserving:

* Price-time priority
* Deterministic behavior
* Correct `remaining` tracking
* Correct event emission

The engine must:

* Match partially
* Leave remainder resting in the book
* Emit accurate events

We are still only dealing with **one price level**.

No cross-level matching yet.

---

## 2️⃣ Concepts Introduced

* Partial fill mechanics
* Remaining quantity tracking
* Order state transitions (implicitly via events)
* Event sequencing correctness
* Trade quantity = `min(taker.remaining, maker.remaining)`

Still NOT introducing:

* Multi-level traversal
* Deterministic sequence counter (that’s Phase 5)
* Edge rejection logic (Phase 6)

---

## 3️⃣ Checklist

### Matching Logic

* [ ] If BUY.quantity > SELL.quantity → SELL fully filled, BUY partially filled
* [ ] If SELL.quantity > BUY.quantity → BUY fully filled, SELL partially filled
* [ ] Remaining updated correctly
* [ ] Resting order stays in book with updated remaining
* [ ] Fully filled order removed from level

### Events

* [ ] Emit `TradeExecuted`
* [ ] Emit `OrderFilled` for fully filled order
* [ ] Emit `OrderPartiallyFilled` for partially filled order
* [ ] Event order is deterministic

### Invariants

* [ ] `0 ≤ remaining ≤ quantity`
* [ ] No negative values
* [ ] Price level removed only if empty

---

## 4️⃣ Test Cases (Phase Completion Gate)

Phase is DONE when these pass:

---

### ✅ Test 1 — Taker Larger Than Maker

Scenario:

SELL 5 @ 100
BUY 10 @ 100

Expected:

* TradeExecuted (quantity 5)
* SELL → OrderFilled
* BUY → OrderPartiallyFilled
* BUY.remaining = 5
* SELL removed from book
* BUY rests in book with remaining 5

---

### ✅ Test 2 — Maker Larger Than Taker

Scenario:

SELL 10 @ 100
BUY 5 @ 100

Expected:

* TradeExecuted (quantity 5)
* BUY → OrderFilled
* SELL → OrderPartiallyFilled
* SELL.remaining = 5
* SELL stays in book
* BUY removed

---

### ✅ Test 3 — Exact Match Still Works

Regression test:

SELL 5 @ 100
BUY 5 @ 100

Expected:

* TradeExecuted (5)
* Both OrderFilled
* Level empty afterward

---

### ✅ Test 4 — Remaining Never Negative

After any partial match:

* remaining >= 0
* remaining <= original quantity

---

When all four pass → Phase 2 DONE.

---

## 5️⃣ Step-by-Step Guide

Follow this order strictly:

---

### Step 1 — Update Matching Logic

Inside your single-level match function:

```ts
const tradeQty = min(taker.remaining, maker.remaining)
```

Then:

```ts
maker.remaining -= tradeQty
taker.remaining -= tradeQty
```

Do NOT mutate quantity.

Only remaining.

---

### Step 2 — Remove Fully Filled Orders

If:

```ts
maker.remaining === 0
```

Remove from level queue.

If taker.remaining === 0:
Stop matching loop.

---

### Step 3 — Emit Events in Correct Order

Recommended order:

1. TradeExecuted
2. OrderFilled / OrderPartiallyFilled (maker)
3. OrderFilled / OrderPartiallyFilled (taker)

Keep it deterministic.

---

### Step 4 — Keep Single-Level Restriction

Do NOT:

* Traverse next price level
* Touch sorting logic
* Touch deterministic trade IDs
* Add edge rejections

Stay scoped.

---

### Step 5 — Run Tests After Every Change

Do not write everything then test.

Add:

* One scenario
* Make it pass
* Move to next

---

# ⚠️ Common Mistake to Avoid

Do NOT:

* Remove partially filled maker
* Reinsert partially filled taker incorrectly
* Mutate original quantity
* Allow negative remaining

Keep it clean.

---

# 📌 Phase 2 Boundary Reminder

We are still only supporting:

* One price level
* No multi-level crossing
* No advanced safety
* No infra

This is still engine purity.

---

If you want, next I can:

* Help you reason about the internal matching loop structure
  or
* Help you design a clean `EngineEvent` type hierarchy before you implement this phase.
