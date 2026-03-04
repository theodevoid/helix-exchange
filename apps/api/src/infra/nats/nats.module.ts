import { Global, Module } from '@nestjs/common';
import { NatsService } from './nats.service';

@Global()
@Module({
  providers: [NatsService],
  exports: [NatsService],
})
export class NatsModule {}
