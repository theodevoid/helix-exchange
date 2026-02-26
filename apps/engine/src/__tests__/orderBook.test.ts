import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { OrderBook } from "../core/OrderBook";
import type { InternalOrder, Side } from "../types";

function createOrder(
  id: string,
  quantity: number,
  price: number,
  side: Side = "BUY"
): InternalOrder {
  const quantityDecimal = new Decimal(quantity);
  const priceDecimal = new Decimal(price);

  return {
    id,
    quantity: quantityDecimal,
    remainingQuantity: quantityDecimal,
    price: priceDecimal,
    side,
    timestamp: Date.now(),
  };
}

describe("OrderBook", () => {
  describe("Adding BUY orders sorts bidPrices DESC", () => {
    it("getBestBid returns highest price when orders added out of order", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "BUY"));
      book.add(createOrder("b", 10, 200, "BUY"));
      book.add(createOrder("c", 10, 150, "BUY"));
      book.add(createOrder("d", 10, 99, "BUY"));

      expect(book.getBestBid()?.toNumber()).toBe(200);
    });

    it("getBestBid returns next highest after best level is emptied and removed", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "BUY"));
      book.add(createOrder("b", 10, 200, "BUY"));
      book.add(createOrder("c", 10, 150, "BUY"));

      const bestLevel = book.getPriceLevel("BUY", new Decimal(200));
      bestLevel?.shift();
      book.removePriceLevelIfEmpty("BUY", new Decimal(200));

      expect(book.getBestBid()?.toNumber()).toBe(150);
    });
  });

  describe("Adding SELL orders sorts askPrices ASC", () => {
    it("getBestAsk returns lowest price when orders added out of order", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "SELL"));
      book.add(createOrder("b", 10, 50, "SELL"));
      book.add(createOrder("c", 10, 75, "SELL"));
      book.add(createOrder("d", 10, 200, "SELL"));

      expect(book.getBestAsk()?.toNumber()).toBe(50);
    });

    it("getBestAsk returns next lowest after best level is emptied and removed", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "SELL"));
      book.add(createOrder("b", 10, 50, "SELL"));
      book.add(createOrder("c", 10, 75, "SELL"));

      const bestLevel = book.getPriceLevel("SELL", new Decimal(50));
      bestLevel?.shift();
      book.removePriceLevelIfEmpty("SELL", new Decimal(50));

      expect(book.getBestAsk()?.toNumber()).toBe(75);
    });
  });

  describe("Price levels created only once per price", () => {
    it("multiple BUY orders at same price share one level", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "BUY"));
      book.add(createOrder("b", 20, 100, "BUY"));
      book.add(createOrder("c", 30, 100, "BUY"));

      const level = book.getPriceLevel("BUY", new Decimal(100));
      expect(book.getBidPrices()).toEqual([new Decimal(100)]);
      expect(level).toBeDefined();
      expect(level?.size()).toBe(3);
    });

    it("multiple SELL orders at same price share one level", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "SELL"));
      book.add(createOrder("b", 20, 100, "SELL"));

      const level = book.getPriceLevel("SELL", new Decimal(100));
      expect(book.getAskPrices()).toEqual([new Decimal(100)]);
      expect(level).toBeDefined();
      expect(level?.size()).toBe(2);
    });
  });

  describe("Orders go into correct side", () => {
    it("BUY and SELL at same price are in separate levels", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("buy-1", 10, 100, "BUY"));
      book.add(createOrder("sell-1", 20, 100, "SELL"));

      const bidLevel = book.getPriceLevel("BUY", new Decimal(100));
      const askLevel = book.getPriceLevel("SELL", new Decimal(100));

      expect(bidLevel).toBeDefined();
      expect(askLevel).toBeDefined();
      expect(bidLevel?.peek()?.id).toBe("buy-1");
      expect(askLevel?.peek()?.id).toBe("sell-1");
    });

    it("getBestBid and getBestAsk return correct sides", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 90, "BUY"));
      book.add(createOrder("b", 10, 110, "SELL"));

      expect(book.getBestBid()?.toNumber()).toBe(90);
      expect(book.getBestAsk()?.toNumber()).toBe(110);
    });
  });

  describe("Removing empty price level cleans arrays", () => {
    it("removing last level leaves empty book", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "BUY"));

      const level = book.getPriceLevel("BUY", new Decimal(100));
      level?.shift();
      book.removePriceLevelIfEmpty("BUY", new Decimal(100));

      expect(book.getBestBid()).toBeUndefined();
      expect(book.getPriceLevel("BUY", new Decimal(100))).toBeUndefined();
    });

    it("removing middle level preserves other levels and sort order", () => {
      const book = new OrderBook("BTC-USD");
      book.add(createOrder("a", 10, 100, "BUY"));
      book.add(createOrder("b", 10, 200, "BUY"));
      book.add(createOrder("c", 10, 150, "BUY"));

      const midLevel = book.getPriceLevel("BUY", new Decimal(150));
      midLevel?.shift();
      book.removePriceLevelIfEmpty("BUY", new Decimal(150));

      expect(book.getBestBid()?.toNumber()).toBe(200);
      expect(book.getPriceLevel("BUY", new Decimal(150))).toBeUndefined();
      expect(book.getPriceLevel("BUY", new Decimal(100))?.size()).toBe(1);
    });
  });
});
