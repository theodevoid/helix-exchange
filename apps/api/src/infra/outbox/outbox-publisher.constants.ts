export const OUTBOX_PUBLISHER_OPTIONS = Symbol('OUTBOX_PUBLISHER_OPTIONS');

export const DEFAULT_POLL_INTERVAL_MS =
  Number(process.env.OUTBOX_POLL_INTERVAL_MS) || 300;
export const DEFAULT_BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE) || 50;

export const ORDERS_PLACED_SUBJECT = 'orders.placed';
