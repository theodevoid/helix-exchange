# 🧩 v0.1 — Phase 4: FIFO Within Same Level

---

## 1️⃣ Objective

Ensure that within the same price level:

* Orders are matched in strict FIFO order.
* Older orders are always filled before newer ones.
* Partial fills preserve queue order.
* Determinism is maintained.

We are finalizing:

> Price priority (Phase 3) + Time priority (Phase 4)

This completes core matching fairness.

---

## 2️⃣ Concepts Introduced

* FIFO queue correctness
* Queue mutation safety
* Stable order sequencing
* Deterministic traversal inside a level

We are NOT introducing:

* Trade ID sequencing (Phase 5)
* Input validation (Phase 6)
* Multi-market routing changes

---

## 3️⃣ Checklist

### Queue Behavior

* [ ] Orders stored in array as FIFO queue
* [ ] New orders appended with `push`
* [ ] Matching always uses `orders[0]`
* [ ] Fully filled orders removed via `shift`
* [ ] Partially filled maker remains at front

### Determinism

* [ ] Order insertion order defines execution order
* [ ] No sorting inside price level
* [ ] No reordering after partial fill

### Invariants

* [ ] Queue order never changes unintentionally
* [ ] No skipped orders
* [ ] No duplicate removals

---

## 4️⃣ Test Cases (Phase Completion Gate)

Phase is DONE when all pass.

---

### ✅ Test 1 — Two SELL Orders Same Price

Scenario:

SELL A: 5 @ 100 (earlier)
SELL B: 5 @ 100 (later)
BUY 5 @ 100

Expected:

* Match against SELL A only
* SELL A filled
* SELL B untouched
* SELL B remains in queue

---

### ✅ Test 2 — Partial Fill Across Same Level

Scenario:

SELL A: 5 @ 100
SELL B: 5 @ 100
BUY 7 @ 100

Expected:

* Match 5 against A
* Match 2 against B
* A removed
* B.remaining = 3
* B stays at front of level

---

### ✅ Test 3 — Three Orders FIFO Integrity

Scenario:

SELL A: 3 @ 100
SELL B: 3 @ 100
SELL C: 3 @ 100
BUY 4 @ 100

Expected:

* A filled (3)
* B partially filled (1 remaining 2)
* C untouched
* Queue order now:

  * B (remaining 2)
  * C (3)

---

### ✅ Test 4 — Deterministic Replay

Given same insertion sequence:

* Matching order always identical
* No variation across runs

---

## 5️⃣ Step-by-step Guide

---

### Step 1 — Ensure Level Structure Is FIFO

Your `PriceLevel` should look like:

```ts
{
  price: Decimal
  orders: InternalOrder[] // FIFO
}
```

Insertion:

```ts
orders.push(newOrder)
```

Matching always reads:

```ts
const maker = level.orders[0]
```

Never use forEach. Never scan whole array.

---

### Step 2 — Partial Fill Handling

If maker.remaining > tradeQty:

* Decrease maker.remaining
* DO NOT remove from queue

If maker.remaining === 0:

```ts
level.orders.shift()
```

That’s it.

---

### Step 3 — Continue Matching Same Level Until:

* taker.remaining === 0
  OR
* level.orders.length === 0

Only then move to next price level (Phase 3 logic).

---

### Step 4 — Avoid Reordering Bugs

Do NOT:

* Sort orders inside level
* Filter array
* Rebuild array
* Splice from middle

Only:

* push (new orders)
* shift (fully filled maker)

Minimal operations = maximal determinism.

---

# ⚠️ Common Mistakes

Avoid:

* Accidentally matching newer order first
* Removing partially filled maker
* Iterating index while shifting
* Mutating array while looping incorrectly

Correct pattern:

```ts
while (level.orders.length > 0 && taker.remaining > 0) {
  const maker = level.orders[0]
  ...
}
```

No index-based loop.

---

# 📌 Phase 4 Boundary Reminder

At this point, engine supports:

✔ Multi-level price priority
✔ FIFO time priority
✔ Partial fills
✔ Deterministic traversal

We now have full **price-time priority matching**.

Still missing:

* Deterministic trade ID sequencing (Phase 5)
* Edge validation + safety guards (Phase 6)
* Multi-market manager (Phase 7)
