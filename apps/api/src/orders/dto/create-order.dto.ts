import { IsEnum, IsString, IsUUID, Matches } from 'class-validator';
import { OrderSide } from '../../../generated/prisma/enums';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export class CreateOrderDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  marketId!: string;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsString()
  @Matches(DECIMAL_PATTERN, {
    message: 'price must be a positive decimal',
  })
  price!: string;

  @IsString()
  @Matches(DECIMAL_PATTERN, {
    message: 'quantity must be a positive decimal',
  })
  quantity!: string;
}
