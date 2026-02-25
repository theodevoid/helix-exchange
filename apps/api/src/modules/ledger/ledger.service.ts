import { PrismaService } from "@infrastructure/database/prisma.service";
import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { LedgerEntryInput, PostJournalInput } from "./ledger.types";

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post a double-entry journal atomically.
   *
   * Rules enforced:
   *  1. Per asset, total debits must equal total credits (balanced journal).
   *  2. Ledger rows are write-once; this service never exposes update or delete.
   *  3. Entry creation and balance mutations are committed in a single transaction.
   *  4. available >= 0 and locked >= 0 for all affected balances.
   */
  async postJournal(input: PostJournalInput): Promise<void> {
    this.validateBalance(input.entries);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.ledgerEntry.createMany({
          data: input.entries.map((entry) => ({
            userId: entry.userId,
            assetId: entry.assetId,
            debit: entry.debit,
            credit: entry.credit,
            referenceType: entry.referenceType,
            referenceId: entry.referenceId,
          })),
        });

        for (const delta of input.balanceDeltas ?? []) {
          await tx.balance.upsert({
            where: {
              userId_assetId: { userId: delta.userId, assetId: delta.assetId },
            },
            create: {
              userId: delta.userId,
              assetId: delta.assetId,
              available: delta.availableDelta,
              locked: delta.lockedDelta,
            },
            update: {
              available: { increment: delta.availableDelta },
              locked: { increment: delta.lockedDelta },
            },
          });
        }

        const keys = [
          ...new Set(
            (input.balanceDeltas ?? []).map((d) => `${d.userId}:${d.assetId}`)
          ),
        ];

        if (keys.length > 0) {
          const balances = await tx.balance.findMany({
            where: {
              OR: keys.map((k) => {
                const [userId, assetId] = k.split(":");
                return { userId, assetId };
              }),
            },
          });

          for (const b of balances) {
            const available = new Decimal(b.available.toString());
            const locked = new Decimal(b.locked.toString());

            if (available.lt(0) || locked.lt(0)) {
              throw new BadRequestException(
                `Balance constraint violated: userId=${b.userId} assetId=${b.assetId} available=${available} locked=${locked}; available and locked must be >= 0`
              );
            }
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private validateBalance(entries: LedgerEntryInput[]): void {
    const totals = new Map<string, { debit: Decimal; credit: Decimal }>();

    for (const entry of entries) {
      const current = totals.get(entry.assetId) ?? {
        debit: new Decimal(0),
        credit: new Decimal(0),
      };

      totals.set(entry.assetId, {
        debit: current.debit.plus(entry.debit),
        credit: current.credit.plus(entry.credit),
      });
    }

    for (const [assetId, { debit, credit }] of totals) {
      if (!debit.equals(credit)) {
        throw new BadRequestException(
          `Unbalanced journal: asset ${assetId} debit ${debit} ≠ credit ${credit}`
        );
      }
    }
  }
}
