# v0.2 — Phase 2: Outbox Pattern Implementation

---

# 1️⃣ Objective

Implement a **transactional outbox publisher** that reads events from the `outbox` table and publishes them to **NATS JetStream**.

The outbox ensures:

* no event loss
* no partial writes
* reliable event delivery
* correct ordering

Events must only be published **after the DB transaction commits**.

---

# 2️⃣ Concepts Introduced

## Transactional Outbox Pattern

The API transaction writes:

```
orders
balances
outbox_event
```

Then a background worker publishes the event.

Flow:

```
POST /orders
   ↓
DB transaction
   ↓
insert order
insert outbox event
commit
   ↓
Outbox Worker
   ↓
Publish event to NATS
   ↓
Mark event as published
```

---

## Polling Publisher

A worker periodically executes:

```
SELECT * FROM outbox
WHERE published = false
ORDER BY created_at
LIMIT N
```

For each event:

```
publish → NATS
mark published
```

---

## At-Least-Once Delivery

Outbox guarantees:

```
event will eventually be published
```

Duplicates may occur in rare cases, so downstream consumers must be **idempotent**.

For v0.2 we accept this.

---

# 3️⃣ Checklist

### Outbox Publisher

* [ ] Create `OutboxPublisherService`
* [ ] Poll database for unpublished events
* [ ] Publish events to NATS
* [ ] Mark events as published

---

### Polling

* [ ] Poll interval configured (e.g. 200–500ms)
* [ ] Limit number of events per poll
* [ ] Always publish oldest events first

---

### Publishing

* [ ] Publish `OrderPlaced` events
* [ ] Serialize payload as JSON
* [ ] Use NATS subject for orders

---

### Status Updates

* [ ] Update `published = true`
* [ ] Set `published_at`

---

### Error Handling

* [ ] Failed publish does NOT mark event as published
* [ ] Worker retries on next poll

---

# 4️⃣ Test Cases (Phase Completion Gate)

Phase is DONE when all pass.

---

### Test 1 — Outbox Event Gets Published

Create order.

DB:

```
outbox
published = false
```

Worker runs.

Expected:

```
event published to NATS
published = true
published_at set
```

---

### Test 2 — Multiple Events Maintain Order

Insert events:

```
event1
event2
event3
```

Expected publish order:

```
event1
event2
event3
```

Ordering must follow `created_at`.

---

### Test 3 — Failed Publish Retries

Simulate NATS failure.

Expected:

```
event remains published=false
worker retries next cycle
```

No data loss.

---

### Test 4 — Worker Handles Batch Publishing

Insert 10 events.

Worker configured with:

```
LIMIT 5
```

Expected:

```
first poll → publish 5
second poll → publish remaining
```

---

### Test 5 — Published Events Not Reprocessed

Events with:

```
published = true
```

Must never be picked up again.

---

# 5️⃣ Step-by-step Guide

---

# Step 1 — Install NATS Client

Example dependency:

```
npm install nats
```

---

# Step 2 — Create NATS Connection

Example:

```ts
const nc = await connect({
  servers: process.env.NATS_URL
})
```

JetStream will be used in Phase 3.

For now simple publish is acceptable.

---

# Step 3 — Create Outbox Publisher Service

Example:

```ts
@Injectable()
export class OutboxPublisherService {
  async poll() {
    const events = await prisma.outboxEvent.findMany({
      where: { published: false },
      orderBy: { createdAt: "asc" },
      take: 50
    })
  }
}
```

---

# Step 4 — Publish Event

Example:

```ts
await nats.publish(
  `orders.placed`,
  JSON.stringify(event.payload)
)
```

Subject naming convention:

```
orders.placed
```

---

# Step 5 — Mark Event Published

After successful publish:

```ts
await prisma.outboxEvent.update({
  where: { id: event.id },
  data: {
    published: true,
    publishedAt: new Date()
  }
})
```

---

# Step 6 — Run Worker Loop

Example:

```ts
setInterval(() => {
  publisher.poll()
}, 300)
```

Production systems often use job queues, but polling is fine here.

---

# Expected Event Structure

Published event example:

```json
{
  "type": "OrderPlaced",
  "data": {
    "orderId": "...",
    "accountId": "...",
    "marketId": "BTC-USDT",
    "side": "BUY",
    "price": "30000",
    "quantity": "1"
  }
}
```

---

# Phase Boundary Reminder

At the end of **Phase 2** we have:

```
orders API
balance locking
outbox table
outbox publisher
events published to NATS
```

Still missing:

```
JetStream streams
engine subscription
trade events
```
