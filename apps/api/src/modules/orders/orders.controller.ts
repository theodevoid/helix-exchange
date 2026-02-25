import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import Decimal from 'decimal.js';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('order')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Session() session: UserSession,
    @Body() dto: CreateOrderDto
  ) {
    const quantity = new Decimal(dto.quantity);
    const price = dto.price != null ? new Decimal(dto.price) : undefined;

    const order = await this.orders.createOrder({
      userId: session.user.id,
      marketId: dto.marketId,
      side: dto.side,
      type: dto.type,
      price,
      quantity,
    });

    return {
      id: order.id,
      userId: order.userId,
      marketId: order.marketId,
      side: order.side,
      type: order.type,
      price: order.price?.toString() ?? null,
      quantity: order.quantity.toString(),
      remainingQuantity: order.remainingQuantity.toString(),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
