# v0.2 — Phase 1: Order Persistence + Balance Locking

## 1) Objective

Create the **authoritative order entry flow** in the NestJS application.

When a client calls `POST /orders`, the system must:

1. Validate the request
2. Verify the account exists
3. Verify sufficient **available balance**
4. Move required funds from **available → locked**
5. Persist the order
6. Write an `OrderPlaced` event into the **outbox table**
7. Commit everything in a **single database transaction**

The matching engine is **not involved yet**.

---

# 2) Concepts Introduced

### Authoritative Order Entry

All orders must pass through the API layer before reaching the engine.

This layer guarantees:

* funds exist
* funds are reserved
* order is persisted

The engine only receives **validated orders**.

---

### Balance Locking

Orders reserve funds.

For a **BUY order**:

```
lockAmount = price * quantity
```

Quote asset is locked.

Example:

```
BUY BTC @ 10000 USDT
quantity = 2

lock = 20000 USDT
```

---

For a **SELL order**:

```
lockAmount = quantity
```

Base asset is locked.

Example:

```
SELL 1 BTC
lock = 1 BTC
```

---

### Available vs Locked Balance

Each balance has two values:

```
available
locked
```

Order placement performs:

```
available -= lockAmount
locked += lockAmount
```

---

### Transactional Outbox

The order and its event must be stored in the **same database transaction**.

This guarantees:

```
order persisted
AND
event recorded
```

Either both succeed or both fail.

Publishing to NATS will come in Phase 2.

---

# 3) Checklist

### Database Schema

* [ ] Create `accounts` table
* [ ] Create `balances` table
* [ ] Create `orders` table
* [ ] Create `outbox` table

---

### API

* [ ] Implement `POST /orders`
* [ ] Validate request structure
* [ ] Validate account existence

---

### Balance Logic

* [ ] Retrieve balance row
* [ ] Verify sufficient available balance
* [ ] Deduct available
* [ ] Increase locked

---

### Order Persistence

* [ ] Insert order with status `OPEN`
* [ ] Store price, quantity, remaining

---

### Outbox Event

* [ ] Insert `OrderPlaced` event
* [ ] Include order payload

---

### Transaction

* [ ] Wrap order + balance + outbox in single DB transaction

---

# 4) Test Cases (Phase Completion Gate)

Phase is DONE when all pass.

---

### Test 1 — Successful BUY Order

Initial balance:

```
USDT
available: 10000
locked: 0
```

Request:

```
BUY BTC
price: 1000
quantity: 5
```

Expected:

```
available: 5000
locked: 5000
```

Order created.

Outbox event written.

---

### Test 2 — Successful SELL Order

Initial balance:

```
BTC
available: 10
locked: 0
```

Request:

```
SELL BTC
quantity: 4
```

Expected:

```
available: 6
locked: 4
```

Order created.

---

### Test 3 — Insufficient Balance

Initial balance:

```
USDT
available: 1000
```

Request:

```
BUY BTC
price: 500
quantity: 3
```

Required:

```
1500
```

Expected:

```
Request rejected
No order created
No outbox event
```

---

### Test 4 — Transaction Atomicity

Simulate DB failure after order insert.

Expected:

```
order NOT persisted
balance NOT updated
outbox NOT written
```

Transaction must rollback.

---

### Test 5 — Outbox Record Created

After valid order:

Outbox table contains:

```
event_type: OrderPlaced
payload: { order data }
status: pending
```

---

# 5) Step-by-step Guide

### Step 1 — Create Database Tables

Minimal schema.

Accounts:

```
accounts
---------
id
created_at
```

---

Balances:

```
balances
---------
account_id
asset
available
locked
```

Primary key:

```
(account_id, asset)
```

---

Orders:

```
orders
---------
id
account_id
market_id
side
price
quantity
remaining
status
created_at
```

---

Outbox:

```
outbox
---------
id
event_type
payload
created_at
published
```

---

### Step 2 — Implement Order DTO

Example request:

```
POST /orders
```

Body:

```
{
  accountId,
  marketId,
  side,
  price,
  quantity
}
```

---

### Step 3 — Start Transaction

Use database transaction:

```
BEGIN
```

All operations must run inside.

---

### Step 4 — Lock Funds

Calculate lock amount.

For BUY:

```
price * quantity
```

For SELL:

```
quantity
```

Update balances:

```
available -= lock
locked += lock
```

---

### Step 5 — Insert Order

Create order:

```
status = OPEN
remaining = quantity
```

---

### Step 6 — Insert Outbox Event

Insert event:

```
event_type = OrderPlaced
payload = order JSON
published = false
```

---

### Step 7 — Commit Transaction

```
COMMIT
```

If anything fails:

```
ROLLBACK
```

---

# Phase Boundary Reminder

At the end of Phase 1 we have:

```
accounts
balances
orders
outbox
POST /orders
balance locking
transaction safety
```

Still missing:

```
NATS publishing
engine integration
trade handling
```
