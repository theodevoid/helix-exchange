import { NatsService } from '@infrastructure/messaging/nats';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxWorker implements OnModuleInit {
  private readonly logger = new Logger(OutboxWorker.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly nats: NatsService
  ) {}

  onModuleInit() {
    this.logger.log('Outbox worker initialized');
  }

  @Cron(CronExpression.EVERY_SECOND)
  async processOutbox(): Promise<void> {
    const events = await this.outbox.getUnpublishedEvents(50);
    if (events.length === 0) return;

    if (!this.nats.getConnection()) {
      this.logger.warn('NATS not connected, skipping outbox processing');
      return;
    }

    for (const event of events) {
      try {
        const payload = JSON.stringify({
          ...(typeof event.payload === 'object' ? event.payload : {}),
          _outboxId: event.id,
        });

        await this.nats.publish(event.topic, new TextEncoder().encode(payload));
        await this.outbox.markPublished(event.id);

        this.logger.debug(`Published event ${event.id} to ${event.topic}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        await this.outbox.recordFailure(event.id, msg);
        
        this.logger.warn(
          `Failed to publish event ${event.id} (attempt ${event.retryCount + 1}): ${msg}`
        );
      }
    }
  }
}
