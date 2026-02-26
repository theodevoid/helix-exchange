import { describe, it, expect } from "vitest";
import { MatchingEngine } from "../core/MatchingEngine";

describe("MatchingEngine", () => {
  describe("Scenario 1: BUY first, SELL second", () => {
    it("matches exact at same price", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "10",
        quantity: "100",
        timestamp: 1,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "10",
        quantity: "100",
        timestamp: 2,
      });

      expect(events).toHaveLength(3);
    });
  });

  describe("Scenario 2: SELL first, BUY second", () => {
    it("matches exact at same price", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "10",
        quantity: "100",
        timestamp: 1,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "10",
        quantity: "100",
        timestamp: 2,
      });

      expect(events).toHaveLength(3);
    });
  });

  describe("Scenario 3: Price mismatch", () => {
    it("should not match", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "10",
        quantity: "100",
        timestamp: 1,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "11",
        quantity: "100",
        timestamp: 2,
      });

      expect(events).toHaveLength(0);
    });
  });
});
