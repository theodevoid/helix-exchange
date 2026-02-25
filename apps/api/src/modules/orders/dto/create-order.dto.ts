import {
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { OrderSide, OrderType } from '../../../generated/prisma/client';

const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;

export class CreateOrderDto {
  @IsUUID()
  marketId!: string;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsEnum(OrderType)
  type!: OrderType;

  @ValidateIf((o) => o.type === OrderType.LIMIT || o.side === OrderSide.BUY)
  @IsString()
  @Matches(POSITIVE_DECIMAL, { message: 'price must be a positive decimal' })
  price?: string;

  @IsString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'quantity must be a positive decimal',
  })
  quantity!: string;
}
