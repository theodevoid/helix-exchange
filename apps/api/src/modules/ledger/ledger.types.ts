import { LedgerReferenceType } from "../../generated/prisma/client";
import Decimal from "decimal.js";

export type LedgerEntryInput = {
  userId: string;
  assetId: string;
  debit: Decimal;
  credit: Decimal;
  referenceType: LedgerReferenceType;
  referenceId: string;
};

export type BalanceDelta = {
  userId: string;
  assetId: string;
  availableDelta: Decimal;
  lockedDelta: Decimal;
};

export type PostJournalInput = {
  entries: LedgerEntryInput[];
  balanceDeltas?: BalanceDelta[];
};