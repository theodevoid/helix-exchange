# Order Creation System Flow

This document describes the end-to-end flow when a user creates an order via `POST /order`.

## Overview

Order creation is **transactional**: the order record, fund locking, and outbox event are written in a single database transaction. Events are published asynchronously by a polling worker, ensuring reliable delivery even when the message broker (NATS) is temporarily unavailable.

---

## 1. HTTP Request

**Endpoint:** `POST /order`

**Authentication:** Required. The request must include a valid Better Auth session cookie. The user ID is taken from `session.user.id`.

**Request body:**

| Field     | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `marketId`| string | Yes      | UUID of the market                    |
| `side`    | enum   | Yes      | `BUY` or `SELL`                      |
| `type`    | enum   | Yes      | `LIMIT` or `MARKET`                 |
| `price`   | string | For LIMIT/BUY | Decimal price (e.g. `"100.50"`) |
| `quantity`| string | Yes      | Order quantity (e.g. `"1.5"`)       |

---

## 2. Controller Layer

`OrdersController.createOrder()`:

- Resolves `userId` from the authenticated session
- Validates and parses `quantity` and `price` as Decimals
- Delegates to `OrdersService.createOrder()`
- Returns the created order in the response (201 Created)

---

## 3. Order Creation (Transactional)

`OrdersService.createOrder()` runs the following **inside a single Serializable transaction**:

### 3.1 Validation (before transaction)

- Quantity must be positive
- Limit orders require a positive price
- Market must exist (lookup by `marketId`)

### 3.2 Transaction Steps

1. **Create order**  
   Insert into `Order` table with `userId`, `marketId`, `side`, `type`, `price`, `quantity`, `remainingQuantity`, `status`.

2. **Lock funds**  
   Move funds from **available** to **locked**:
   - **BUY:** Lock `quantity × price` of the market’s **quote asset**
   - **SELL:** Lock `quantity` of the market’s **base asset**

   Locking is implemented via double-entry ledger entries and balance deltas in `LedgerService.postJournalWithTx()`:
   - Ledger entries with `referenceType: ORDER_LOCK`, `referenceId: orderId`
   - Balance: `available -= amount`, `locked += amount`

3. **Enqueue outbox event**  
   Insert into `OutboxEvent` with:
   - `topic`: `orders.commands.<MARKET>` (e.g. `orders.commands.ACME_USD` for market symbol ACME/USD)
   - `payload`: order snapshot (eventType: 'created', orderId, userId, marketId, side, type, price, quantity, remainingQuantity, status, createdAt)
   - `published`: false

If any step fails (e.g. insufficient balance), the entire transaction rolls back. No order, no lock, no outbox event.

---

## 4. Asynchronous Event Publishing

`OutboxWorker.processOutbox()` runs on a cron schedule (every second):

1. **Poll**  
   Fetch up to 50 unpublished `OutboxEvent` rows with `retryCount < MAX_RETRIES`, respecting exponential backoff.

2. **Publish**  
   For each event:
   - Publish to NATS on the event’s `topic` with the payload
   - On success: mark event as `published`
   - On failure: increment `retryCount`, store `lastError`, set `lastAttemptAt` (retries with exponential backoff)

3. **Delivery**  
   Events are published to JetStream subjects such as `orders.commands.ACME_USD`. Market-based subjects ensure strict FIFO ordering per market. Downstream services (e.g. matching engine) subscribe per-market for ordered processing.

---

## Flow Diagram

```
┌─────────────────┐
│  POST /order    │
│  (authenticated)│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  OrdersController                                            │
│  • Extract userId from session                               │
│  • Parse quantity, price                                     │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  OrdersService.createOrder()                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Serializable transaction                               │ │
│  │  1. tx.order.create()                                   │ │
│  │  2. balance.lockFundsWithTx() → ledger + balance         │ │
│  │  3. outbox.enqueue() → OutboxEvent                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────────────────┐
│  HTTP 201       │     │  OutboxWorker (every 1s)             │
│  Order response │     │  • getUnpublishedEvents()           │
└─────────────────┘     │  • nc.publish(topic, payload)        │
                         │  • markPublished() or recordFailure│
                         └──────────────┬──────────────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────────────┐
                         │  NATS JetStream (orders.commands.MARKET)  │
                         │  → Matching engine / other consumers │
                         └─────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Transactional order + lock + outbox** | Avoids inconsistency: either all succeed or all roll back. No orphan orders or unlocked funds. |
| **Outbox pattern** | Ensures at-least-once event delivery. Events persist in DB; worker retries until success. |
| **Serializable isolation** | Keeps ledger and balance updates consistent under concurrency. |
| **Separate polling worker** | Decouples HTTP handling from publishing. NATS outages do not block order creation. |
| **Exponential backoff** | Reduces load when NATS or downstream services are failing. |
