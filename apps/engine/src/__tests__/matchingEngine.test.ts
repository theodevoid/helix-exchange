import { describe, it, expect } from "vitest";
import { MatchingEngine } from "../core/MatchingEngine";

describe("MatchingEngine", () => {
  describe("Basic matching", () => {
    it("matches exact at same price (1 trade, 2 fills)", () => {
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

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      const fills = events.filter((e) => e.type === "ORDER_FILLED");
      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        price: "10",
        quantity: "100",
        buyOrderId: "buy1",
        sellOrderId: "sell1",
      });
      expect(fills).toHaveLength(2);
    });

    it("no match when prices do not cross", () => {
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

  describe("Phase 3 — SELL crosses multiple bid levels", () => {
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

  describe("Phase 3 — Sorted arrays remain correct after matches", () => {
    it.each([
      {
        scenario: "asks ascending",
        makerOrders: [
          { orderId: "sell1", price: "110", quantity: "5", timestamp: 1 },
          { orderId: "sell2", price: "100", quantity: "5", timestamp: 2 },
        ],
        takerOrder: { orderId: "buy1", price: "120", quantity: "5", timestamp: 3 },
        secondTakerOrder: {
          orderId: "buy2",
          price: "120",
          quantity: "5",
          timestamp: 4,
        },
        firstMatchPrice: "100",
        secondMatchPrice: "110",
        makerSide: "SELL" as const,
        takerSide: "BUY" as const,
      },
      {
        scenario: "bids descending",
        makerOrders: [
          { orderId: "buy1", price: "90", quantity: "5", timestamp: 1 },
          { orderId: "buy2", price: "100", quantity: "5", timestamp: 2 },
        ],
        takerOrder: { orderId: "sell1", price: "80", quantity: "5", timestamp: 3 },
        secondTakerOrder: {
          orderId: "sell2",
          price: "80",
          quantity: "5",
          timestamp: 4,
        },
        firstMatchPrice: "100",
        secondMatchPrice: "90",
        makerSide: "BUY" as const,
        takerSide: "SELL" as const,
      },
    ])(
      "$scenario — second match uses correct next-best price",
      ({
        makerOrders,
        takerOrder,
        secondTakerOrder,
        firstMatchPrice,
        secondMatchPrice,
        makerSide,
        takerSide,
      }) => {
        const engine = new MatchingEngine("BTC-USDT");

        for (const o of makerOrders) {
          engine.process({
            type: "PLACE_LIMIT",
            orderId: o.orderId,
            marketId: "BTC-USDT",
            side: makerSide,
            price: o.price,
            quantity: o.quantity,
            timestamp: o.timestamp,
          });
        }

        const firstMatch = engine.process({
          type: "PLACE_LIMIT",
          orderId: takerOrder.orderId,
          marketId: "BTC-USDT",
          side: takerSide,
          price: takerOrder.price,
          quantity: takerOrder.quantity,
          timestamp: takerOrder.timestamp,
        });
        const firstTrades = firstMatch.filter(
          (e) => e.type === "TRADE_EXECUTED"
        );
        expect(firstTrades[0]).toMatchObject({ price: firstMatchPrice });

        const secondMatch = engine.process({
          type: "PLACE_LIMIT",
          orderId: secondTakerOrder.orderId,
          marketId: "BTC-USDT",
          side: takerSide,
          price: secondTakerOrder.price,
          quantity: secondTakerOrder.quantity,
          timestamp: secondTakerOrder.timestamp,
        });
        const secondTrades = secondMatch.filter(
          (e) => e.type === "TRADE_EXECUTED"
        );
        expect(secondTrades[0]).toMatchObject({ price: secondMatchPrice });
      }
    );
  });

  // --- Phase 4: FIFO Within Same Level ---

  describe("Phase 4 — Test 1: Two SELL orders same price", () => {
    it("matches against SELL A only, A filled, B untouched, B remains in queue", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sellA",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sellB",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 3,
      });

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      const fills = events.filter((e) => e.type === "ORDER_FILLED");

      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        price: "100",
        quantity: "5",
        buyOrderId: "buy1",
        sellOrderId: "sellA",
      });

      const filledIds = fills.map((e) => (e as { orderId: string }).orderId);
      expect(filledIds).toContain("sellA");
      expect(filledIds).toContain("buy1");
      expect(filledIds).not.toContain("sellB");

      // Verify B remains in queue: next BUY should match B
      const followUpEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 4,
      });

      const followUpTrades = followUpEvents.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(followUpTrades).toHaveLength(1);
      expect(followUpTrades[0]).toMatchObject({
        sellOrderId: "sellB",
        quantity: "5",
      });
    });
  });

  describe("Phase 4 — Test 2: Partial fill across same level", () => {
    it("matches 5 against A, 2 against B, A removed, B.remaining=3, B stays at front", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sellA",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sellB",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "7",
        timestamp: 3,
      });

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      const fills = events.filter((e) => e.type === "ORDER_FILLED");

      expect(trades).toHaveLength(2);
      expect(trades[0]).toMatchObject({
        sellOrderId: "sellA",
        quantity: "5",
      });
      expect(trades[1]).toMatchObject({
        sellOrderId: "sellB",
        quantity: "2",
      });

      const filledIds = fills.map((e) => (e as { orderId: string }).orderId);
      expect(filledIds).toContain("sellA");
      expect(filledIds).toContain("buy1");
      expect(filledIds).not.toContain("sellB");

      // Verify B stays at front with remaining 3: next BUY 3 should match B only
      const followUpEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "3",
        timestamp: 4,
      });

      const followUpTrades = followUpEvents.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(followUpTrades).toHaveLength(1);
      expect(followUpTrades[0]).toMatchObject({
        sellOrderId: "sellB",
        quantity: "3",
      });
    });
  });

  describe("Phase 4 — Test 3: Three orders FIFO integrity", () => {
    it("A filled (3), B partially (2 remaining), C untouched; queue order B then C", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sellA",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "3",
        timestamp: 1,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sellB",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "3",
        timestamp: 2,
      });

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sellC",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "3",
        timestamp: 3,
      });

      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "4",
        timestamp: 4,
      });

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      const fills = events.filter((e) => e.type === "ORDER_FILLED");

      expect(trades).toHaveLength(2);
      expect(trades[0]).toMatchObject({ sellOrderId: "sellA", quantity: "3" });
      expect(trades[1]).toMatchObject({ sellOrderId: "sellB", quantity: "1" });

      const filledIds = fills.map((e) => (e as { orderId: string }).orderId);
      expect(filledIds).toContain("sellA");
      expect(filledIds).toContain("buy1");
      expect(filledIds).not.toContain("sellB");
      expect(filledIds).not.toContain("sellC");

      // Verify queue order: B (2 remaining) then C (3). Next BUY 2 matches B only
      const firstFollowUp = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "2",
        timestamp: 5,
      });

      const firstFollowUpTrades = firstFollowUp.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(firstFollowUpTrades).toHaveLength(1);
      expect(firstFollowUpTrades[0]).toMatchObject({
        sellOrderId: "sellB",
        quantity: "2",
      });

      // BUY 3 matches C only
      const secondFollowUp = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy3",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "3",
        timestamp: 6,
      });

      const secondFollowUpTrades = secondFollowUp.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(secondFollowUpTrades).toHaveLength(1);
      expect(secondFollowUpTrades[0]).toMatchObject({
        sellOrderId: "sellC",
        quantity: "3",
      });
    });
  });

  // --- Phase 5: Deterministic Trade Sequence ---

  describe("Phase 5 — Sequential trades", () => {
    it("sequence increments strictly: first trade BTC-USDT-1, second BTC-USDT-2", () => {
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

      const firstEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const firstTrades = firstEvents.filter((e) => e.type === "TRADE_EXECUTED");
      expect(firstTrades).toHaveLength(1);
      expect(firstTrades[0].tradeId).toBe("BTC-USDT-1");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 3,
      });

      const secondEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 4,
      });

      const secondTrades = secondEvents.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(secondTrades).toHaveLength(1);
      expect(secondTrades[0].tradeId).toBe("BTC-USDT-2");
    });
  });

  describe("Phase 5 — Test 2: Multi-level trades generate multiple IDs", () => {
    it("one trade per match: BTC-USDT-1 and BTC-USDT-2", () => {
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
      expect(trades).toHaveLength(2);
      expect(trades[0].tradeId).toBe("BTC-USDT-1");
      expect(trades[1].tradeId).toBe("BTC-USDT-2");
    });
  });

  describe("Phase 5 — Test 3: Deterministic replay", () => {
    it("identical order sequence produces identical trade IDs across runs", () => {
      const run = () => {
        const engine = new MatchingEngine("BTC-USDT");

        engine.process({
          type: "PLACE_LIMIT",
          orderId: "sellA",
          marketId: "BTC-USDT",
          side: "SELL",
          price: "100",
          quantity: "5",
          timestamp: 1,
        });

        engine.process({
          type: "PLACE_LIMIT",
          orderId: "sellB",
          marketId: "BTC-USDT",
          side: "SELL",
          price: "100",
          quantity: "5",
          timestamp: 2,
        });

        return engine.process({
          type: "PLACE_LIMIT",
          orderId: "buyC",
          marketId: "BTC-USDT",
          side: "BUY",
          price: "100",
          quantity: "8",
          timestamp: 3,
        });
      };

      const run1 = run();
      const run2 = run();

      const trades1 = run1.filter((e) => e.type === "TRADE_EXECUTED");
      const trades2 = run2.filter((e) => e.type === "TRADE_EXECUTED");

      expect(trades1.map((t) => t.tradeId)).toEqual(trades2.map((t) => t.tradeId));
    });
  });

  describe("Phase 5 — Test 4: Separate market sequences", () => {
    it("each market has independent sequence: BTC-USDT-1,2 and ETH-USDT-1,2", () => {
      const engineBTC = new MatchingEngine("BTC-USDT");
      const engineETH = new MatchingEngine("ETH-USDT");

      engineBTC.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });
      const btc1 = engineBTC.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      engineETH.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "ETH-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 1,
      });
      const eth1 = engineETH.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "ETH-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const btcTrades1 = btc1.filter((e) => e.type === "TRADE_EXECUTED");
      const ethTrades1 = eth1.filter((e) => e.type === "TRADE_EXECUTED");

      expect(btcTrades1[0].tradeId).toBe("BTC-USDT-1");
      expect(ethTrades1[0].tradeId).toBe("ETH-USDT-1");

      engineBTC.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 3,
      });
      const btc2 = engineBTC.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 4,
      });

      engineETH.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "ETH-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 3,
      });
      const eth2 = engineETH.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "ETH-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 4,
      });

      const btcTrades2 = btc2.filter((e) => e.type === "TRADE_EXECUTED");
      const ethTrades2 = eth2.filter((e) => e.type === "TRADE_EXECUTED");

      expect(btcTrades2[0].tradeId).toBe("BTC-USDT-2");
      expect(ethTrades2[0].tradeId).toBe("ETH-USDT-2");
    });
  });

  // --- Phase 6: Edge Safety ---

  describe("Phase 6 — Reject invalid quantity", () => {
    it.each([
      { quantity: "0", label: "zero" },
      { quantity: "-5", label: "negative" },
    ])("engine rejects $label quantity, orderbook unchanged", ({ quantity }) => {
      const engine = new MatchingEngine("BTC-USDT");

      expect(() =>
        engine.process({
          type: "PLACE_LIMIT",
          orderId: "order1",
          marketId: "BTC-USDT",
          side: "BUY",
          price: "100",
          quantity,
          timestamp: 1,
        })
      ).toThrow("Invalid quantity");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 2,
      });
      const events = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 3,
      });
      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      expect(trades).toHaveLength(1);
    });
  });

  describe("Phase 6 — Test 3: Reject negative price", () => {
    it("engine rejects BUY 5 @ -100", () => {
      const engine = new MatchingEngine("BTC-USDT");

      expect(() =>
        engine.process({
          type: "PLACE_LIMIT",
          orderId: "buy1",
          marketId: "BTC-USDT",
          side: "BUY",
          price: "-100",
          quantity: "5",
          timestamp: 1,
        })
      ).toThrow("Invalid price");
    });
  });

  describe("Phase 6 — Test 4: Remaining never exceeds quantity", () => {
    it("SELL 10 @ 100, BUY 7 @ 100 — SELL.remaining = 3, invariant holds", () => {
      const engine = new MatchingEngine("BTC-USDT");

      engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell1",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "10",
        timestamp: 1,
      });

      const firstEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy1",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "7",
        timestamp: 2,
      });

      const firstTrades = firstEvents.filter((e) => e.type === "TRADE_EXECUTED");
      expect(firstTrades).toHaveLength(1);
      expect(firstTrades[0]).toMatchObject({ quantity: "7", sellOrderId: "sell1" });

      const secondEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "3",
        timestamp: 3,
      });

      const secondTrades = secondEvents.filter(
        (e) => e.type === "TRADE_EXECUTED"
      );
      expect(secondTrades).toHaveLength(1);
      expect(secondTrades[0]).toMatchObject({ quantity: "3", sellOrderId: "sell1" });
    });
  });

  describe("Phase 6 — Test 5: Empty level removed", () => {
    it("SELL 5 @ 100, BUY 5 @ 100 — level removed, arrays updated, orderbook empty", () => {
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
        price: "100",
        quantity: "5",
        timestamp: 2,
      });

      const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
      expect(trades).toHaveLength(1);

      const restingEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "buy2",
        marketId: "BTC-USDT",
        side: "BUY",
        price: "100",
        quantity: "5",
        timestamp: 3,
      });

      expect(restingEvents).toHaveLength(0);

      const matchEvents = engine.process({
        type: "PLACE_LIMIT",
        orderId: "sell2",
        marketId: "BTC-USDT",
        side: "SELL",
        price: "100",
        quantity: "5",
        timestamp: 4,
      });

      const matchTrades = matchEvents.filter((e) => e.type === "TRADE_EXECUTED");
      expect(matchTrades).toHaveLength(1);
      expect(matchTrades[0]).toMatchObject({ buyOrderId: "buy2", quantity: "5" });
    });
  });

  describe("Phase 6 — Test 6: No zero trade events", () => {
    it("engine never emits TradeExecuted with quantity 0", () => {
      const scenarios = [
        () => {
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
          return engine.process({
            type: "PLACE_LIMIT",
            orderId: "buy1",
            marketId: "BTC-USDT",
            side: "BUY",
            price: "100",
            quantity: "5",
            timestamp: 2,
          });
        },
        () => {
          const engine = new MatchingEngine("BTC-USDT");
          engine.process({
            type: "PLACE_LIMIT",
            orderId: "sell1",
            marketId: "BTC-USDT",
            side: "SELL",
            price: "100",
            quantity: "10",
            timestamp: 1,
          });
          return engine.process({
            type: "PLACE_LIMIT",
            orderId: "buy1",
            marketId: "BTC-USDT",
            side: "BUY",
            price: "100",
            quantity: "7",
            timestamp: 2,
          });
        },
        () => {
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
          return engine.process({
            type: "PLACE_LIMIT",
            orderId: "buy1",
            marketId: "BTC-USDT",
            side: "BUY",
            price: "120",
            quantity: "10",
            timestamp: 3,
          });
        },
      ];

      for (const run of scenarios) {
        const events = run();
        const trades = events.filter((e) => e.type === "TRADE_EXECUTED");
        for (const t of trades) {
          expect(t.quantity).not.toBe("0");
        }
      }
    });
  });
});
