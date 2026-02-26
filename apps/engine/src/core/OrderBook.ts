import Decimal from "decimal.js";
import { InternalOrder, Side } from "../types";
import { PriceLevel } from "./PriceLevel";

type PriceLevelMap = Map<string, PriceLevel>;

export class OrderBook {
  private bids: PriceLevelMap;
  private asks: PriceLevelMap;

  // Sort: DESC for BUY, ASC for SELL
  private bidPrices: Decimal[];
  private askPrices: Decimal[];

  constructor(public readonly marketId: string) {
    this.bids = new Map<string, PriceLevel>();
    this.asks = new Map<string, PriceLevel>();
    this.bidPrices = [];
    this.askPrices = [];
  }

  add(order: InternalOrder) {
    const priceKey = order.price.toString();
    const map = order.side === "BUY" ? this.bids : this.asks;
    const prices = order.side === "BUY" ? this.bidPrices : this.askPrices;

    let level = map.get(priceKey);

    if (!level) {
      level = new PriceLevel(order.price);
      map.set(priceKey, level);
      this.insertPriceSorted(prices, order.price, order.side);
    }
    level.add(order);
  }

  private compare(a: Decimal, b: Decimal) {
    return a.comparedTo(b);
  }

  private insertPriceSorted(
    prices: Decimal[],
    priceToInsert: Decimal,
    side: Side
  ) {
    const pos = prices.findIndex((p) =>
      side === "BUY"
        ? this.compare(p, priceToInsert) < 0
        : this.compare(p, priceToInsert) > 0
    );

    const insertAt = pos === -1 ? prices.length : pos;

    prices.splice(insertAt, 0, priceToInsert);
  }

  getBestBid(): Decimal | undefined {
    return this.bidPrices[0];
  }

  getBestAsk(): Decimal | undefined {
    return this.askPrices[0];
  }

  getPriceLevel(side: Side, price: Decimal): PriceLevel | undefined {
    const map = side === "BUY" ? this.bids : this.asks;

    return map.get(price.toString());
  }

  removePriceLevelIfEmpty(side: Side, price: Decimal) {
    const map = side === "BUY" ? this.bids : this.asks;
    const prices = side === "BUY" ? this.bidPrices : this.askPrices;
    const priceKey = price.toString();
    const level = map.get(priceKey);

    if (level?.isEmpty()) {
      map.delete(priceKey);
      const idx = prices.findIndex((p) => p.equals(price));
      if (idx !== -1) prices.splice(idx, 1);
    }
  }

  getAskPrices() {
    return this.askPrices;
  }

  getBidPrices() {
    return this.bidPrices;
  }
}
