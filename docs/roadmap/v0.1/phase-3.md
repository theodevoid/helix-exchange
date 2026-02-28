# 🧩 v0.1 — Phase 3: Multiple Price Levels

---

## 1️⃣ Objective

Extend the engine to support **cross-level price matching** while enforcing:

* Price priority (best price first)
* Deterministic traversal
* Correct remaining tracking
* Correct level cleanup

The engine must now:

* Traverse multiple price levels
* Consume best prices first
* Continue matching until:

  * Taker fully filled, OR
  * No more matchable prices

Still no FIFO within same level refinement (that’s Phase 4).

---

## 2️⃣ Concepts Introduced

* Price crossing logic
* Best price discovery
* Sorted price array traversal
* Matching loop across levels
* Level cleanup when empty

We are NOT introducing:

* Trade ID sequencing (Phase 5)
* Edge validation (Phase 6)
* Cancel logic

---

## 3️⃣ Checklist

### Price Priority

* [ ] BUY matches lowest ask first
* [ ] SELL matches highest bid first
* [ ] Price arrays remain correctly sorted

### Matching Loop

* [ ] Continue matching while:

  * Taker.remaining > 0
  * Best opposing price satisfies limit condition
* [ ] Stop when no crossing price exists

### Level Cleanup

* [ ] Remove empty price levels
* [ ] Remove price from sorted array
* [ ] No ghost price levels

### Invariants

* [ ] No negative remaining
* [ ] No duplicate price entries
* [ ] No stale empty levels

---

## 4️⃣ Test Cases (Phase Completion Gate)

Phase is DONE when all pass.

---

### ✅ Test 1 — BUY Crosses Multiple Ask Levels

Scenario:

SELL 5 @ 100
SELL 5 @ 110
BUY 10 @ 120

Expected:

* First match @ 100 (5)
* Then match @ 110 (5)
* BUY fully filled
* Both levels removed
* Orderbook empty

---

### ✅ Test 2 — Partial Cross Across Levels

Scenario:

SELL 5 @ 100
SELL 5 @ 110
BUY 7 @ 120

Expected:

* Match 5 @ 100
* Match 2 @ 110
* BUY fully filled
* SELL @ 110 remains with 3
* Only one level removed

---

### ✅ Test 3 — No Cross Due To Price

Scenario:

SELL 5 @ 100
BUY 5 @ 90

Expected:

* No trade
* Both orders resting
* Levels unchanged

---

### ✅ Test 4 — SELL Crossing Multiple Bids

Scenario:

BUY 5 @ 100
BUY 5 @ 90
SELL 8 @ 80

Expected:

* Match 5 @ 100
* Match 3 @ 90
* SELL fully filled
* BUY @ 90 remains with 2

---

### ✅ Test 5 — Sorted Arrays Remain Correct

After any matches:

* `askPrices` ascending
* `bidPrices` descending

---

## 5️⃣ Step-by-step Guide

Follow this carefully.

---

### Step 1 — Determine Best Opposing Price

For BUY:

```ts id="n1xkqa"
const bestAsk = askPrices[0]
```

For SELL:

```ts id="x9e4ks"
const bestBid = bidPrices[0]
```

Never scan entire map. Always use sorted arrays.

---

### Step 2 — Check Price Crossing

BUY matches if:

```ts id="v1p8er"
bestAsk <= taker.price
```

SELL matches if:

```ts id="a7l3kp"
bestBid >= taker.price
```

If condition fails → stop matching.

---

### Step 3 — Match Entire Level Before Moving On

Inside loop:

* Match against first order in level (Phase 2 logic)
* If level empty:

  * Remove price level
  * Remove price from sorted array
  * Continue to next best level

Repeat until:

* taker.remaining == 0
  OR
* No crossing level exists

---

### Step 4 — Maintain Deterministic Traversal

Important:

* Always traverse sorted arrays in fixed order
* Never iterate over Map keys directly
* Do not rely on JS Map insertion order

Sorted arrays are your source of truth.

---

### Step 5 — Do Not Break Previous Behavior

Regression test:

* Single-level partial fills still pass
* Exact match still passes

If Phase 2 breaks → Phase 3 is not done.

---

# ⚠️ Common Pitfalls

Avoid:

* Forgetting to remove empty level
* Forgetting to remove price from sorted array
* Iterating wrong direction (asks must be ASC)
* Modifying price arrays during iteration incorrectly

---

# 📌 Phase 3 Boundary Reminder

We now support:

* Multi-level price crossing
* Proper price priority

We still do NOT:

* Guarantee FIFO correctness across multiple same-price orders (Phase 4)
* Guarantee deterministic trade IDs (Phase 5)
* Reject invalid input (Phase 6)
