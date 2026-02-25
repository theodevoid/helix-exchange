import Decimal from "decimal.js";

export type DepositInput = {
  userId: string;
  assetId: string;
  amount: Decimal;
  referenceId?: string;
};

export type LockFundsInput = {
  userId: string;
  assetId: string;
  amount: Decimal;
  orderId: string;
};

export type ReleaseFundsInput = {
  userId: string;
  assetId: string;
  amount: Decimal;
  orderId: string;
};
