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

  // --- Phase 3: Multiple Price Levels ---

  describe("Phase 3 — Test 1: BUY crosses multiple ask levels", () => {
    it("matches lowest ask first, then next ask, BUY fully filled, orderbook empty", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "110",
        quantity: "5",
        timestamp: 2,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "120",
        quantity: "10",
        timestamp: 3,
      });

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      const fills = events.filter((e) => e.type === "ORDER_FILLED");

      expect(trades).toHaveLength(2);
      expect(fills).toHaveLength(3);

      expect(trades[0]).toMatchObject({ price: "100", quantity: "5" });
      expect(trades[1]).toMatchObject({ price: "110", quantity: "5" });

      const filledIds = fills.map((e) => (e as { orderId: string }).orderId);
      expect(filledIds).toContain("sell1");
      expect(filledIds).toContain("sell2");
      expect(filledIds).toContain("buy1");
    });
  });

  describe("Phase 3 — Test 2: Partial cross across levels", () => {
    it("matches full first level, partial second level, BUY fully filled, second SELL remains", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "110",
        quantity: "5",
        timestamp: 2,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "120",
        quantity: "7",
        timestamp: 3,
      });

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      const fills = events.filter((e) => e.type === "ORDER_FILLED");

      expect(trades).toHaveLength(2);
      expect(trades[0]).toMatchObject({ price: "100", quantity: "5" });
      expect(trades[1]).toMatchObject({ price: "110", quantity: "2" });

      const filledIds = fills.map((e) => (e as { orderId: string }).orderId);
      expect(filledIds).toContain("sell1");
      expect(filledIds).toContain("buy1");
      expect(filledIds).not.toContain("sell2");
    });
  });

  describe("Phase 3 — Test 3: No cross due to price", () => {
    it("no trade when BUY price is below SELL price, both orders rest", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "90",
        quantity: "5",
        timestamp: 2,
      });

      expect(events).toHaveLength(0);
    });
  });

  describe("Phase 3 — Test 4: SELL crosses multiple bid levels", () => {
    it("matches highest bid first, then next bid, SELL fully filled, second BUY remains partial", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "90",
        quantity: "5",
        timestamp: 2,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "80",
        quantity: "8",
        timestamp: 3,
      });

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      const fills = events.filter((e) => e.type === "ORDER_FILLED");

      expect(trades).toHaveLength(2);
      expect(trades[0]).toMatchObject({ price: "100", quantity: "5" });
      expect(trades[1]).toMatchObject({ price: "90", quantity: "3" });

      const filledIds = fills.map((e) => (e as { orderId: string }).orderId);
      expect(filledIds).toContain("buy1");
      expect(filledIds).toContain("sell1");
      expect(filledIds).not.toContain("buy2");
    });
  });

  describe("Phase 3 — Test 5: Sorted arrays remain correct after matches", () => {
    it("askPrices stay ascending — next BUY matches second-lowest ask after first is consumed", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "110",
        quantity: "5",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const firstMatch = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "120",
        quantity: "5",
        timestamp: 3,
      });

      const firstTrades = firstMatch.filter((e) => e.type === "TRADE_EXECUTED");
      expect(firstTrades[0]).toMatchObject({ price: "100" });

      const secondMatch = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "120",
        quantity: "5",
        timestamp: 4,
      });

      const secondTrades = secondMatch.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(secondTrades[0]).toMatchObject({ price: "110" });
    });

    it("bidPrices stay descending — next SELL matches second-highest bid after first is consumed", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "90",
        quantity: "5",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const firstMatch = engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "80",
        quantity: "5",
        timestamp: 3,
      });

      const firstTrades = firstMatch.filter((e) => e.type === "TRADE_EXECUTED");
      expect(firstTrades[0]).toMatchObject({ price: "100" });

      const secondMatch = engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "80",
        quantity: "5",
        timestamp: 4,
      });

      const secondTrades = secondMatch.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(secondTrades[0]).toMatchObject({ price: "90" });
    });
  });
});
