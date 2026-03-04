import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { NatsService } from '@/infra/nats/nats.service';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_POLL_INTERVAL_MS,
  ORDERS_PLACED_SUBJECT,
  OUTBOX_PUBLISHER_OPTIONS,
} from './outbox-publisher.constants';
import type {
  OrderPlacedPayload,
  OutboxPublisherOptions,
} from './outbox-publisher.types';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    @Optional()
    @Inject(OUTBOX_PUBLISHER_OPTIONS)
    options?: OutboxPublisherOptions,
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  onModuleInit(): void {
    if (process.env.E2E_SKIP_OUTBOX_POLL === '1') return;
    this.pollIntervalId = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const events = await this.prisma.outbox.findMany({
        where: { published: false },
        orderBy: { createdAt: 'asc' },
        take: this.batchSize,
      });

      for (const event of events) {
        try {
          const payload = this.buildPublishPayload(event);
          this.nats.publish(ORDERS_PLACED_SUBJECT, JSON.stringify(payload));
          await this.prisma.outbox.update({
            where: { id: event.id },
            data: {
              published: true,
              publishedAt: new Date(),
            },
          });
        } catch {
          // Publish failed, do not mark as published, let fail open, will retry next poll
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  private buildPublishPayload(event: { eventType: string; payload: unknown }): {
    type: string;
    data: Record<string, unknown>;
  } {
    const p = event.payload as OrderPlacedPayload & Record<string, unknown>;
    const data: Record<string, unknown> = {
      orderId: p.id,
      accountId: p.accountId,
      marketId: p.marketId,
      side: p.side,
      price: p.price,
      quantity: p.quantity,
    };
    return {
      type: event.eventType,
      data,
    };
  }
}
