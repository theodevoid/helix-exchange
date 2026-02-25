/**
 * Reconciliation script: Ledger → Balance validation
 *
 * 1. Recalculates balances from ledger entries (sum of debit - credit per userId/assetId)
 * 2. Compares with stored Balance rows (available + locked)
 * 3. Validates no drift
 */

import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

type RecalculatedBalance = {
  userId: string;
  assetId: string;
  total: Decimal;
};

type StoredBalance = {
  userId: string;
  assetId: string;
  available: Decimal;
  locked: Decimal;
  total: Decimal;
};

type Drift = {
  userId: string;
  assetId: string;
  recalculatedTotal: Decimal;
  storedTotal: Decimal;
  difference: Decimal;
};

async function recalculateBalancesFromLedger(): Promise<RecalculatedBalance[]> {
  const entries = await prisma.ledgerEntry.findMany({
    orderBy: { createdAt: "asc" },
  });

  const byKey = new Map<string, Decimal>();

  for (const entry of entries) {
    const key = `${entry.userId}:${entry.assetId}`;
    const debit = new Decimal(entry.debit.toString());
    const credit = new Decimal(entry.credit.toString());

    const current = byKey.get(key) ?? new Decimal(0);
    byKey.set(key, current.plus(debit).minus(credit));
  }

  return Array.from(byKey.entries()).map(([key, total]) => {
    const [userId, assetId] = key.split(":");
    return { userId, assetId, total };
  });
}

async function getStoredBalances(): Promise<StoredBalance[]> {
  const rows = await prisma.balance.findMany();

  return rows.map((row) => {
    const available = new Decimal(row.available.toString());
    const locked = new Decimal(row.locked.toString());
    return {
      userId: row.userId,
      assetId: row.assetId,
      available,
      locked,
      total: available.plus(locked),
    };
  });
}

function findDrift(
  recalculated: RecalculatedBalance[],
  stored: StoredBalance[]
): Drift[] {
  const recalcMap = new Map(
    recalculated.map((r) => [`${r.userId}:${r.assetId}`, r])
  );
  const storedMap = new Map(stored.map((s) => [`${s.userId}:${s.assetId}`, s]));

  const allKeys = new Set([...recalcMap.keys(), ...storedMap.keys()]);
  const drifts: Drift[] = [];

  const ZERO = new Decimal(0);

  for (const key of allKeys) {
    const recalc = recalcMap.get(key);
    const storedRow = storedMap.get(key);

    const recalculatedTotal = recalc?.total ?? ZERO;
    const storedTotal = storedRow?.total ?? ZERO;

    const difference = recalculatedTotal.minus(storedTotal);

    if (!difference.equals(0)) {
      const [userId, assetId] = key.split(":");
      drifts.push({
        userId,
        assetId,
        recalculatedTotal,
        storedTotal,
        difference,
      });
    }
  }

  return drifts;
}

async function main() {
  console.log("=== Ledger → Balance Reconciliation ===\n");

  const recalculated = await recalculateBalancesFromLedger();
  const stored = await getStoredBalances();

  console.log(`Ledger entries: recalculated ${recalculated.length} (userId, assetId) pairs`);
  console.log(`Stored balances: ${stored.length} rows\n`);

  const drifts = findDrift(recalculated, stored);

  if (drifts.length === 0) {
    console.log("✓ No drift detected. All balances reconcile.");
    return;
  }

  console.error(`✗ DRIFT DETECTED: ${drifts.length} discrepancy(ies)\n`);

  for (const d of drifts) {
    console.error(
      `  userId=${d.userId} assetId=${d.assetId} | ` +
        `ledger total=${d.recalculatedTotal} stored total=${d.storedTotal} | ` +
        `difference=${d.difference}`
    );
  }

  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
