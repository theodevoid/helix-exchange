import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { PriceLevel } from "../core/PriceLevel";
import type { InternalOrder } from "../types";

function createOrder(id: string, quantity: number, price: number): InternalOrder {
  return {
    id,
    quantity,
    remainingQuantity: quantity,
    price: new Decimal(price),
    side: "BUY",
  };
}

describe("PriceLevel", () => {
  describe("FIFO order", () => {
    it("stores and returns orders in FIFO order", () => {
      const orderA = createOrder("a", 10, 100);
      const orderB = createOrder("b", 20, 100);
      const orderC = createOrder("c", 30, 100);
      const level = new PriceLevel(new Decimal(100), [orderA, orderB, orderC]);

      expect(level.peek()).toBe(orderA);
      expect(level.shift()).toBe(orderA);
      expect(level.peek()).toBe(orderB);
      expect(level.shift()).toBe(orderB);
      expect(level.peek()).toBe(orderC);
      expect(level.shift()).toBe(orderC);
    });
  });

  describe("peek()", () => {
    it("does not remove the order from the level", () => {
      const order = createOrder("a", 10, 100);
      const level = new PriceLevel(new Decimal(100), [order]);

      expect(level.peek()).toBe(order);
      expect(level.peek()).toBe(order);
      expect(level.size()).toBe(1);
    });
  });

  describe("shift()", () => {
    it("removes orders in correct FIFO order", () => {
      const orderA = createOrder("a", 10, 100);
      const orderB = createOrder("b", 20, 100);
      const level = new PriceLevel(new Decimal(100), [orderA, orderB]);

      expect(level.shift()).toBe(orderA);
      expect(level.size()).toBe(1);
      expect(level.shift()).toBe(orderB);
      expect(level.size()).toBe(0);
    });

    it("returns undefined when level is empty", () => {
      const level = new PriceLevel(new Decimal(100), []);
      expect(level.shift()).toBeUndefined();
    });
  });

  describe("isEmpty()", () => {
    it("returns true when level has no orders", () => {
      const level = new PriceLevel(new Decimal(100), []);
      expect(level.isEmpty()).toBe(true);
    });

    it("returns false when level has orders", () => {
      const order = createOrder("a", 10, 100);
      const level = new PriceLevel(new Decimal(100), [order]);
      expect(level.isEmpty()).toBe(false);
    });

    it("returns true after all orders are shifted", () => {
      const order = createOrder("a", 10, 100);
      const level = new PriceLevel(new Decimal(100), [order]);

      expect(level.isEmpty()).toBe(false);
      level.shift();
      expect(level.isEmpty()).toBe(true);
    });
  });
});
