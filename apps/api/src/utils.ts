import { BadRequestException } from '@nestjs/common';

export const MARKET_ID_REGEX = /^[A-Z0-9]+_[A-Z0-9]+$/;

export function parseMarketId(marketId: string): {
  base: string;
  quote: string;
} {
  if (!MARKET_ID_REGEX.test(marketId)) {
    throw new BadRequestException(
      `marketId must be in BASE_QUOTE format (e.g. BTC_USDT)`,
    );
  }
  const [base, quote] = marketId.split('_');
  return { base, quote };
}
