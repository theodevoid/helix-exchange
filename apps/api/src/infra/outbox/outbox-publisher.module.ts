import { Module } from '@nestjs/common';
import { NatsModule } from '@/infra/nats/nats.module';
import { PrismaModule } from '@/infra/prisma/prisma.module';
import { OutboxPublisherService } from './outbox-publisher.service';

@Module({
  imports: [PrismaModule, NatsModule],
  providers: [OutboxPublisherService],
  exports: [OutboxPublisherService],
})
export class OutboxPublisherModule {}
