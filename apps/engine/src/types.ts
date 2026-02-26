import Decimal from "decimal.js";

export type Side = "BUY" | "SELL";

export type InternalOrder = {
  id: string;
  quantity: number;
  remainingQuantity: number;
  price: Decimal;
  side: Side;
}