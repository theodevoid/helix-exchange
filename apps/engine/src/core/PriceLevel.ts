import Decimal from "decimal.js";
import { InternalOrder } from "../types";

export class PriceLevel {
  constructor(
    public readonly price: Decimal,
    public readonly orders: InternalOrder[]
  ) {}

  add(order: InternalOrder) {
    this.orders.push(order);
  }

  peek() {
    return this.orders[0];
  }

  shift() {
    return this.orders.shift();
  }

  isEmpty() {
    return this.orders.length === 0;
  }

  size() {
    return this.orders.length;
  }
}
