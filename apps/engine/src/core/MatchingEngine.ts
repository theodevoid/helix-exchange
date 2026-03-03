import Decimal from "decimal.js";
import {
  EngineEvent,
  InternalOrder,
  OrderFilled,
  PlaceLimitOrder,
  TradeExecuted,
} from "../types";
import { OrderBook } from "./OrderBook";

export class MatchingEngine {
  private book: OrderBook;
  private tradeSequence = 0;

  constructor(private readonly marketId: string) {
    this.book = new OrderBook(marketId);
  }

  process(command: PlaceLimitOrder): EngineEvent[] {
    if (command.type !== "PLACE_LIMIT") {
      return [];
    }

    const price = new Decimal(command.price);
    const quantity = new Decimal(command.quantity);

    if (price.lte(0) || quantity.lte(0)) {
      return [];
    }

    const incomingOrder: InternalOrder = {
      id: command.orderId,
      side: command.side,
      price,
      quantity,
      remainingQuantity: quantity,
      timestamp: command.timestamp,
    };

    const events: EngineEvent[] = [];
    const oppSide = command.side === "BUY" ? "SELL" : "BUY";

    // Matching loop: iterate across price levels until filled or no more crossable levels
    while (incomingOrder.remainingQuantity.gt(0)) {
      const bestOppPrice =
        incomingOrder.side === "BUY"
          ? this.book.getBestAsk()
          : this.book.getBestBid();

      if (!bestOppPrice) break;

      // Check if prices cross:
      // BUY crosses if incomingPrice >= bestAsk
      // SELL crosses if incomingPrice <= bestBid
      const crosses =
        incomingOrder.side === "BUY"
          ? incomingOrder.price.gte(bestOppPrice)
          : incomingOrder.price.lte(bestOppPrice);

      if (!crosses) break;

      const priceLevel = this.book.getPriceLevel(oppSide, bestOppPrice);

      if (!priceLevel) break;

      // Consume orders at this level in FIFO order
      while (incomingOrder.remainingQuantity.gt(0)) {
        const restingOrder = priceLevel.peek();
        if (!restingOrder) break;

        const tradeQty = Decimal.min(
          incomingOrder.remainingQuantity,
          restingOrder.remainingQuantity
        );

        this.tradeSequence += 1;
        const tradeId = `${this.marketId}-${this.tradeSequence}`;

        const buyOrderId =
          command.side === "BUY" ? incomingOrder.id : restingOrder.id;
        const sellOrderId =
          command.side === "BUY" ? restingOrder.id : incomingOrder.id;

        const trade: TradeExecuted = {
          type: "TRADE_EXECUTED",
          marketId: this.marketId,
          tradeId,
          buyOrderId,
          sellOrderId,
          price: bestOppPrice.toString(),
          quantity: tradeQty.toString(),
        };
        events.push(trade);

        incomingOrder.remainingQuantity =
          incomingOrder.remainingQuantity.minus(tradeQty);
        restingOrder.remainingQuantity =
          restingOrder.remainingQuantity.minus(tradeQty);

        if (restingOrder.remainingQuantity.isZero()) {
          priceLevel.shift();
          const filledResting: OrderFilled = {
            type: "ORDER_FILLED",
            marketId: this.marketId,
            orderId: restingOrder.id,
          };
          events.push(filledResting);
        }
      }

      this.book.removePriceLevelIfEmpty(oppSide, bestOppPrice);
    }

    if (incomingOrder.remainingQuantity.isZero()) {
      const filledIncoming: OrderFilled = {
        type: "ORDER_FILLED",
        marketId: this.marketId,
        orderId: incomingOrder.id,
      };
      events.push(filledIncoming);
    } else {
      // Order has remaining quantity — rest on the book
      this.book.add(incomingOrder);
    }

    return events;
  }
}
