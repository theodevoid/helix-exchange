import { OutboxModule } from '@infrastructure/outbox/outbox.module';
import { Module } from '@nestjs/common';
import { BalancesModule } from '../balances/balances.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [OutboxModule, BalancesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
