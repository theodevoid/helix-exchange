import { OutboxService } from '@infrastructure/outbox/outbox.service';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderSide, OrderType, Prisma } from '../../generated/prisma/client';
import Decimal from 'decimal.js';
import { BalanceService } from '../balances/balances.service';
import { ORDER_CREATED_TOPIC } from './orders.constants';
import { CreateOrderInput } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly balance: BalanceService
  ) {}

  /**
   * Create an order, lock funds, and enqueue an outbox event in a single transaction.
   * - BUY: locks quantity * price of quote asset
   * - SELL: locks quantity of base asset
   */
  async createOrder(input: CreateOrderInput) {
    const quantity = new Decimal(input.quantity);
    const remainingQuantity = quantity;
    const price = input.price != null ? new Decimal(input.price) : null;

    if (quantity.lte(0)) {
      throw new BadRequestException('Quantity must be positive');
    }
    if (input.type === OrderType.LIMIT && (price == null || price.lte(0))) {
      throw new BadRequestException('Limit orders require a positive price');
    }

    const market = await this.prisma.market.findUnique({
      where: { id: input.marketId },
      select: { baseAssetId: true, quoteAssetId: true },
    });
    if (!market) {
      throw new BadRequestException('Market not found');
    }

    return this.prisma.$transaction(
      async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: input.userId,
          marketId: input.marketId,
          side: input.side,
          type: input.type,
          price: price ?? undefined,
          quantity,
          remainingQuantity,
        },
      });

      const lockAmount =
        input.side === OrderSide.BUY
          ? quantity.times(price ?? 0)
          : quantity;
      const lockAssetId =
        input.side === OrderSide.BUY
          ? market.quoteAssetId
          : market.baseAssetId;

      if (lockAmount.lte(0)) {
        throw new BadRequestException(
          'Lock amount must be positive; BUY orders require a price'
        );
      }

      await this.balance.lockFundsWithTx(tx, {
        userId: input.userId,
        assetId: lockAssetId,
        amount: lockAmount,
        orderId: order.id,
      });

      await this.outbox.enqueue(tx, ORDER_CREATED_TOPIC, {
        orderId: order.id,
        userId: order.userId,
        marketId: order.marketId,
        side: order.side,
        type: order.type,
        price: order.price?.toString() ?? null,
        quantity: order.quantity.toString(),
        remainingQuantity: order.remainingQuantity.toString(),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      });

      return order;
    },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
