import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, type NatsConnection, StringCodec } from 'nats';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private nc: NatsConnection | null = null;
  private readonly sc = StringCodec();

  async onModuleInit(): Promise<void> {
    const url = process.env.NATS_URL ?? 'nats://localhost:4222';
    this.nc = await connect({
      servers: url,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
      this.nc = null;
    }
  }

  publish(subject: string, data: string): void {
    if (!this.nc) {
      throw new Error('NATS connection not initialized');
    }
    this.nc.publish(subject, this.sc.encode(data));
  }
}
