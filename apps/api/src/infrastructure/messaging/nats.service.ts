import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, JetStreamClient, NatsConnection } from 'nats';

/** Subjects that use JetStream for persistence and per-market ordering */
const JETSTREAM_SUBJECT_PREFIXES = [
  'orders.commands.',
  'orders.events.',
  'trades.events.',
] as const;

function useJetStream(topic: string): boolean {
  return JETSTREAM_SUBJECT_PREFIXES.some((p) => topic.startsWith(p));
}

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection | null = null;
  private js: JetStreamClient | null = null;

  async onModuleInit() {
    const url = process.env.NATS_URL ?? 'nats://localhost:4222';
    this.connection = await connect({ servers: url });
    this.js = this.connection.jetstream();
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.js = null;
    }
  }

  getConnection(): NatsConnection | null {
    return this.connection;
  }

  /** Publish to JetStream when subject is orders.* or trades.* for persistence & ordering */
  async publish(subject: string, data: Uint8Array): Promise<void> {
    const nc = this.connection;
    if (!nc) throw new Error('NATS not connected');

    if (useJetStream(subject) && this.js) {
      await this.js.publish(subject, data);
    } else {
      nc.publish(subject, data);
    }
  }
}
