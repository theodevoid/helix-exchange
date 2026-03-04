import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderSide, OrderStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrderDto } from './dto/create-order.dto';

const MARKET_ID_REGEX = /^[A-Z0-9]+_[A-Z0-9]+$/;

function parseMarketId(marketId: string): { base: string; quote: string } {
  if (!MARKET_ID_REGEX.test(marketId)) {
    throw new BadRequestException(
      `marketId must be in BASE_QUOTE format (e.g. BTC_USDT)`,
    );
  }
  const [base, quote] = marketId.split('_');
  return { base, quote };
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(dto: CreateOrderDto) {
    const { accountId, marketId, side, price, quantity } = dto;
    const priceNum = parseFloat(price);
    const quantityNum = parseFloat(quantity);

    if (priceNum <= 0 || quantityNum <= 0) {
      throw new BadRequestException('price and quantity must be positive');
    }

    const { base, quote } = parseMarketId(marketId);

    const lockAmount =
      side === OrderSide.BUY ? priceNum * quantityNum : quantityNum;
    const assetToLock = side === OrderSide.BUY ? quote : base;

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.accounts.findUnique({
        where: { id: accountId },
      });
      if (!account) {
        throw new NotFoundException(`Account ${accountId} not found`);
      }

      const balance = await tx.balances.findUnique({
        where: {
          accountId_asset: { accountId, asset: assetToLock },
        },
      });

      if (!balance) {
        throw new BadRequestException(
          `Insufficient balance: no ${assetToLock} balance for account`,
        );
      }

      const availableNum = Number(balance.available);
      if (availableNum < lockAmount) {
        throw new BadRequestException(
          `Insufficient balance: required ${lockAmount} ${assetToLock}, available ${availableNum}`,
        );
      }

      const now = new Date();
      const orderId = crypto.randomUUID();
      const outboxId = crypto.randomUUID();

      await tx.balances.update({
        where: {
          accountId_asset: { accountId, asset: assetToLock },
        },
        data: {
          available: { decrement: lockAmount },
          locked: { increment: lockAmount },
          updatedAt: now,
        },
      });

      const order = await tx.orders.create({
        data: {
          id: orderId,
          accountId,
          marketId,
          side,
          price: priceNum,
          quantity: quantityNum,
          remaining: quantityNum,
          status: OrderStatus.OPEN,
          updatedAt: now,
        },
      });

      await tx.outbox.create({
        data: {
          id: outboxId,
          eventType: 'OrderPlaced',
          payload: {
            id: order.id,
            accountId: order.accountId,
            marketId: order.marketId,
            side: order.side,
            price: order.price.toString(),
            quantity: order.quantity.toString(),
            remaining: order.remaining.toString(),
            status: order.status,
            createdAt: order.createdAt.toISOString(),
          },
          published: false,
        },
      });

      return order;
    });
  }
}
