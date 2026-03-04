import { describe, it, expect } from "vitest";
import { MatchingEngineManager } from "../core/MatchingEngineManager";

describe("MatchingEngineManager", () => {
  describe("Phase 7 — Test 1: Two markets independent", () => {
    it("BTC-USDT and ETH-USDT have independent trade sequences", () => {
      const manager = new MatchingEngineManager();

      manager.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });
      const btcEvents = manager.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      manager.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "ETH-USDT",
        side: "SELL",
        price: "200",
        quantity: "3",
        timestamp: 3,
      });
      const ethEvents = manager.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "ETH-USDT",
        side: "BUY",
        price: "200",
        quantity: "3",
        timestamp: 4,
      });

      const btcTrades = btcEvents.filter((e) => e.type === "TRADE_EXECUTED");
      const ethTrades = ethEvents.filter((e) => e.type === "TRADE_EXECUTED");

      expect(btcTrades).toHaveLength(1);
      expect(ethTrades).toHaveLength(1);

      expect(btcTrades[0].tradeId).toBe("BTC-USDT-1");
      expect(ethTrades[0].tradeId).toBe("ETH-USDT-1");
    });
  });

  describe("Phase 7 — Test 2: Orderbooks are separate", () => {
    it("each market has its own orderbook, no cross interaction", () => {
      const manager = new MatchingEngineManager();

      manager.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      manager.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "ETH-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const btcEvents = manager.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 3,
      });

      const ethEvents = manager.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "ETH-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 4,
      });

      const btcTrades = btcEvents.filter((e) => e.type === "TRADE_EXECUTED");
      const ethTrades = ethEvents.filter((e) => e.type === "TRADE_EXECUTED");

      expect(btcTrades).toHaveLength(1);
      expect(btcTrades[0]).toMatchObject({
        tradeId: "BTC-USDT-1",
        sellOrderId: "sell1",
        quantity: "5",
      });

      expect(ethTrades).toHaveLength(1);
      expect(ethTrades[0]).toMatchObject({
        tradeId: "ETH-USDT-1",
        sellOrderId: "sell1",
        quantity: "5",
      });
    });
  });

  describe("Phase 7 — Test 3: Cross-market matching never happens", () => {
    it("BTC-USDT SELL and ETH-USDT BUY do not match", () => {
      const manager = new MatchingEngineManager();

      manager.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      const events = manager.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "ETH-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      expect(events).toHaveLength(0);
    });
  });

  describe("Phase 7 — Test 4: Engine auto-creation", () => {
    it("manager creates new engine automatically on first order for new market", () => {
      const manager = new MatchingEngineManager();

      const events = manager.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "SOL-USDT",
        side: "SELL",
        price: "50",
        quantity: "10",
        timestamp: 1,
      });

      expect(events).toHaveLength(0);

      const matchEvents = manager.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "SOL-USDT",
        side: "BUY",
        price: "50",
        quantity: "10",
        timestamp: 2,
      });

      const trades = matchEvents.filter((e) => e.type === "TRADE_EXECUTED");
      expect(trades).toHaveLength(1);
      expect(trades[0].tradeId).toBe("SOL-USDT-1");
    });
  });
});
