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

    const oppSide = command.side === "BUY" ? "SELL" : "BUY";

    const bestOppositeSidePrice =
      incomingOrder.side === "BUY"
        ? this.book.getBestAsk()
        : this.book.getBestBid();

    // No opposite side price. Only insert.
    if (!bestOppositeSidePrice) {
      this.book.add(incomingOrder);
      return [];
    }

    // Phase 1: Exact match
    if (!bestOppositeSidePrice.equals(price)) {
      this.book.add(incomingOrder);
      return [];
    }

    const priceLevel = this.book.getPriceLevel(oppSide, bestOppositeSidePrice);

    if (!priceLevel) {
      this.book.add(incomingOrder);
      return [];
    }

    const restingOrder = priceLevel.peek();

    if (!restingOrder) {
      this.book.add(incomingOrder);
      return [];
    }

    if (!restingOrder.remainingQuantity.equals(incomingOrder.quantity)) {
      this.book.add(incomingOrder);
      return [];
    }

    // ----- EXECUTE TRADE -----
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
      price: bestOppositeSidePrice.toString(),
      quantity: incomingOrder.quantity.toString(),
    };

    priceLevel.shift();
    this.book.removePriceLevelIfEmpty(oppSide, bestOppositeSidePrice);

    const filledIncoming: OrderFilled = {
      type: "ORDER_FILLED",
      marketId: this.marketId,
      orderId: incomingOrder.id,
    };

    const filledResting: OrderFilled = {
      type: "ORDER_FILLED",
      marketId: this.marketId,
      orderId: restingOrder.id,
    };

    return [trade, filledIncoming, filledResting];
  }
}
