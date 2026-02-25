import { OrderSide, OrderType } from '../../generated/prisma/client';
import Decimal from 'decimal.js';

export type CreateOrderInput = {
  userId: string;
  marketId: string;
  side: OrderSide;
  type: OrderType;
  price?: Decimal;
  quantity: Decimal;
};
