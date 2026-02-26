import Decimal from "decimal.js";

export type Side = "BUY" | "SELL";

export type InternalOrder = {
  id: string
  side: Side
  price: Decimal
  quantity: Decimal
  remainingQuantity: Decimal
  timestamp: number
}