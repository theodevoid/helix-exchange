import { Global, Module } from '@nestjs/common';
import { NatsService } from './nats';

@Global()
@Module({
  providers: [NatsService],
  exports: [NatsService],
})
export class MessagingModule {}
