import { PrismaService } from "@infrastructure/database/prisma.service";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LedgerReferenceType } from "../../generated/prisma/client";
import Decimal from "decimal.js";
import { TransactionClient } from "../../../prisma/types";
import { LedgerService } from "../ledger/ledger.service";
import type {
  DepositInput,
  LockFundsInput,
  ReleaseFundsInput,
} from "./balances.types";

@Injectable()
export class BalanceService {
  private readonly systemUserId: string;

  constructor(
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    this.systemUserId =
      config.get<string>("SYSTEM_USER_ID") ??
      "00000000-0000-0000-0000-000000000001";
  }

  /**
   * Ensure a balance row exists for the user/asset with 0 available, 0 locked.
   * No ledger entries are created.
   */
  async ensureBalance(userId: string, assetId: string): Promise<void> {
    await this.prisma.balance.upsert({
      where: { userId_assetId: { userId, assetId } },
      create: { userId, assetId, available: 0, locked: 0 },
      update: {},
    });
  }

  /**
   * Credit the user's available balance (deposit). Creates balance if not exists.
   */
  async deposit(input: DepositInput): Promise<void> {
    const amount = new Decimal(input.amount);

    if (amount.lte(0)) {
      throw new BadRequestException("Deposit amount must be positive");
    }

    const referenceId = input.referenceId ?? `deposit-${Date.now()}`;

    await this.ledger.postJournal({
      entries: [
        {
          userId: input.userId,
          assetId: input.assetId,
          debit: amount,
          credit: new Decimal(0),
          referenceType: LedgerReferenceType.DEPOSIT,
          referenceId,
        },
        {
          userId: this.systemUserId,
          assetId: input.assetId,
          debit: new Decimal(0),
          credit: amount,
          referenceType: LedgerReferenceType.DEPOSIT,
          referenceId,
        },
      ],
      balanceDeltas: [
        {
          userId: input.userId,
          assetId: input.assetId,
          availableDelta: amount,
          lockedDelta: new Decimal(0),
        },
      ],
    });
  }

  /**
   * Move funds from available to locked inside an existing transaction.
   * Use when composing with order creation in a single atomic operation.
   */
  async lockFundsWithTx(
    tx: TransactionClient,
    input: LockFundsInput
  ): Promise<void> {
    const amount = new Decimal(input.amount);

    if (amount.lte(0)) {
      throw new BadRequestException("Lock amount must be positive");
    }

    await this.ledger.postJournalWithTx(tx, {
      entries: [
        {
          userId: input.userId,
          assetId: input.assetId,
          debit: amount,
          credit: new Decimal(0),
          referenceType: LedgerReferenceType.ORDER_LOCK,
          referenceId: input.orderId,
        },
        {
          userId: input.userId,
          assetId: input.assetId,
          debit: new Decimal(0),
          credit: amount,
          referenceType: LedgerReferenceType.ORDER_LOCK,
          referenceId: input.orderId,
        },
      ],
      balanceDeltas: [
        {
          userId: input.userId,
          assetId: input.assetId,
          availableDelta: amount.neg(),
          lockedDelta: amount,
        },
      ],
    });
  }

  /**
   * Move funds from available to locked (for order placement).
   */
  async lockFunds(input: LockFundsInput): Promise<void> {
    const amount = new Decimal(input.amount);

    if (amount.lte(0)) {
      throw new BadRequestException("Lock amount must be positive");
    }

    await this.ledger.postJournal({
      entries: [
        {
          userId: input.userId,
          assetId: input.assetId,
          debit: amount,
          credit: new Decimal(0),
          referenceType: LedgerReferenceType.ORDER_LOCK,
          referenceId: input.orderId,
        },
        {
          userId: input.userId,
          assetId: input.assetId,
          debit: new Decimal(0),
          credit: amount,
          referenceType: LedgerReferenceType.ORDER_LOCK,
          referenceId: input.orderId,
        },
      ],
      balanceDeltas: [
        {
          userId: input.userId,
          assetId: input.assetId,
          availableDelta: amount.neg(),
          lockedDelta: amount,
        },
      ],
    });
  }

  /**
   * Move funds from locked to available (for order cancellation).
   */
  async releaseFunds(input: ReleaseFundsInput): Promise<void> {
    const amount = new Decimal(input.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("Release amount must be positive");
    }

    await this.ledger.postJournal({
      entries: [
        {
          userId: input.userId,
          assetId: input.assetId,
          debit: new Decimal(0),
          credit: amount,
          referenceType: LedgerReferenceType.ORDER_RELEASE,
          referenceId: input.orderId,
        },
        {
          userId: input.userId,
          assetId: input.assetId,
          debit: amount,
          credit: new Decimal(0),
          referenceType: LedgerReferenceType.ORDER_RELEASE,
          referenceId: input.orderId,
        },
      ],
      balanceDeltas: [
        {
          userId: input.userId,
          assetId: input.assetId,
          availableDelta: amount,
          lockedDelta: amount.neg(),
        },
      ],
    });
  }
}
