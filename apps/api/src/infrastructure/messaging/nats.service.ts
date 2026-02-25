import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, NatsConnection } from 'nats';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection | null = null;

  async onModuleInit() {
    const url = process.env.NATS_URL ?? 'nats://localhost:4222';
    this.connection = await connect({ servers: url });
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  getConnection(): NatsConnection | null {
    return this.connection;
  }
}
