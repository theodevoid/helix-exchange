import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsModule } from './infra/nats/nats.module';
import { OutboxPublisherModule } from './infra/outbox/outbox-publisher.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    PrismaModule,
    NatsModule,
    OutboxPublisherModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
