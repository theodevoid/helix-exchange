import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { NatsService } from '../infrastructure/messaging/nats.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  @Get()
  @AllowAnonymous()
  async check() {
    const db = await this.checkDatabase();
    const messaging = await this.checkMessaging();

    return {
      status: db && messaging ? 'ok' : 'degraded',
      database: db ? 'ok' : 'error',
      messaging: messaging ? 'ok' : 'error',
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkMessaging(): Promise<boolean> {
    try {
      const conn = this.nats.getConnection();
      return conn !== null && !conn.isClosed();
    } catch {
      return false;
    }
  }
}
