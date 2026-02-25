/** Market symbol to NATS subject token: ACME/USD → ACME_USD */
export function marketSymbolToSubject(symbol: string): string {
  return symbol.replace('/', '_');
}

/** Build order command subject for a market (e.g. orders.commands.ACME_USD) */
export function orderCommandSubject(marketSymbol: string): string {
  return `orders.commands.${marketSymbolToSubject(marketSymbol)}`;
}

/** Build order event subject for a market */
export function orderEventSubject(marketSymbol: string, eventType: string): string {
  return `orders.events.${marketSymbolToSubject(marketSymbol)}.${eventType}`;
}

/** Build trade event subject for a market */
export function tradeEventSubject(marketSymbol: string): string {
  return `trades.events.${marketSymbolToSubject(marketSymbol)}`;
}
