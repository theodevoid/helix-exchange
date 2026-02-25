import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';

@Module({
  providers: [OutboxService, OutboxWorker],
  exports: [OutboxService],
})
export class OutboxModule {}
