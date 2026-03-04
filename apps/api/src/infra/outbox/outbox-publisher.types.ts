export type OutboxPublisherOptions = {
  pollIntervalMs?: number;
  batchSize?: number;
};

export type OrderPlacedPayload = {
  id?: string;
  accountId?: string;
  marketId?: string;
  side?: string;
  price?: string;
  quantity?: string;
};
