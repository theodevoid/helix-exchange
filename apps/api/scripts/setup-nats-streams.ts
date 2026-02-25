/**
 * NATS JetStream stream setup for the exchange platform.
 *
 * Creates three streams with market-based subject naming:
 * - orders.commands.<MARKET>  (e.g. orders.commands.ACME_USD)
 * - orders.events.<MARKET>
 * - trades.events.<MARKET>
 *
 * Strict ordering is enforced per market: each subject (e.g. orders.commands.ACME_USD)
 * receives messages in FIFO order. Consumers subscribe per-market for strict ordering.
 */

import {
  connect,
  DiscardPolicy,
  RetentionPolicy,
  StorageType,
} from 'nats';

const STREAMS = [
  {
    name: 'ORDERS_COMMANDS',
    subjects: ['orders.commands.>'],
    description: 'Order commands (e.g. create) per market for strict ordering',
  },
  {
    name: 'ORDERS_EVENTS',
    subjects: ['orders.events.>'],
    description: 'Order lifecycle events per market',
  },
  {
    name: 'TRADES_EVENTS',
    subjects: ['trades.events.>'],
    description: 'Trade execution events per market',
  },
] as const;

async function main() {
  const url = process.env.NATS_URL ?? 'nats://localhost:4222';

  console.log(`Connecting to NATS at ${url}...`);
  const nc = await connect({ servers: url });

  try {
    const jsm = await nc.jetstreamManager();

    for (const stream of STREAMS) {
      try {
        await jsm.streams.add({
          name: stream.name,
          subjects: [...stream.subjects],
          storage: StorageType.File,
          retention: RetentionPolicy.Limits,
          discard: DiscardPolicy.Old,
          max_msgs: 1_000_000,
          max_age: 7 * 24 * 60 * 60 * 1e9, // 7 days in nanoseconds
          description: stream.description,
        });
        console.log(`✓ Stream "${stream.name}" created (subjects: ${stream.subjects.join(', ')})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('already in use') || msg.includes('stream name already in use')) {
          console.log(`  Stream "${stream.name}" already exists, skipping`);
        } else {
          throw err;
        }
      }
    }

    console.log('\nNATS JetStream streams ready.');
  } finally {
    await nc.close();
  }
}

main().catch((err) => {
  console.error('Failed to setup NATS streams:', err);
  process.exit(1);
});
