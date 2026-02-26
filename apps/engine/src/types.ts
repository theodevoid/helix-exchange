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

export type PlaceLimitOrder = {
  type: "PLACE_LIMIT"
  orderId: string
  marketId: string
  side: Side
  price: string
  quantity: string
  timestamp: number
}

export type TradeExecuted = {
  type: "TRADE_EXECUTED"
  marketId: string
  tradeId: string
  buyOrderId: string
  sellOrderId: string
  price: string
  quantity: string
}

export type OrderFilled = {
  type: "ORDER_FILLED"
  marketId: string
  orderId: string
}

export type EngineEvent =
  | TradeExecuted
  | OrderFilled