import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { AppController } from './app.controller';
import { DatabaseModule } from './infrastructure/database/database.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './modules/orders/orders.module';
import { MarketsModule } from './modules/markets/markets.module';
import { BalancesModule } from './modules/balances/balances.module';
import { LedgerModule } from './modules/ledger/ledger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule.forRoot({ auth }),
    DatabaseModule,
    MessagingModule,
    OutboxModule,
    OrdersModule,
    MarketsModule,
    BalancesModule,
    LedgerModule,
  ],
  controllers: [AppController, HealthController],
})
export class AppModule {}
