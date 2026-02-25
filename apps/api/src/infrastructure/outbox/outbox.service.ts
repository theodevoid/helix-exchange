import { PrismaService } from '@infrastructure/database/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionClient } from '../../../prisma/types';
import { INITIAL_BACKOFF_MS, MAX_BACKOFF_MS, MAX_RETRIES } from './outbox.constants';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enqueue an event to be published. Must be called inside a transaction
   * so the outbox write is committed atomically with the business data.
   */
  async enqueue(
    tx: TransactionClient,
    topic: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        topic,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Fetch unpublished events that are eligible for retry (respecting backoff).
   * Returns events where either never attempted or backoff period has elapsed.
   */
  async getUnpublishedEvents(limit = 100): Promise<
    Array<{
      id: string;
      topic: string;
      payload: unknown;
      retryCount: number;
      lastAttemptAt: Date | null;
    }>
  > {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        published: false,
        retryCount: { lt: MAX_RETRIES },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const now = Date.now();
    return events
      .filter((e) => {
        if (e.lastAttemptAt == null) return true;
        const backoff = getBackoffMs(e.retryCount);
        return now - e.lastAttemptAt.getTime() >= backoff;
      })
      .map((e) => ({
        id: e.id,
        topic: e.topic,
        payload: e.payload as unknown,
        retryCount: e.retryCount,
        lastAttemptAt: e.lastAttemptAt,
      }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        published: true,
        lastError: null,
      },
    });
  }

  async recordFailure(id: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        lastError: error.slice(0, 2000),
        lastAttemptAt: new Date(),
      },
    });
  }
}

export function getBackoffMs(retryCount: number): number {
  const backoff = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(2, retryCount),
    MAX_BACKOFF_MS
  );
  return backoff;
}
