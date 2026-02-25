import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const assets = [
    { symbol: "USD", precision: 2 },
    { symbol: "IDR", precision: 0 },
    { symbol: "ACME", precision: 8 },
    { symbol: "SGD", precision: 2 },
  ];

  const assetIds: Record<string, string> = {};

  for (const asset of assets) {
    const result = await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      create: asset,
      update: { precision: asset.precision },
    });
    assetIds[asset.symbol] = result.id;
    console.log(`Asset ${asset.symbol} (${result.id})`);
  }

  const markets = [
    { symbol: "ACME/USD", base: "ACME", quote: "USD" },
    { symbol: "ACME/SGD", base: "ACME", quote: "SGD" },
    { symbol: "ACME/IDR", base: "ACME", quote: "IDR" },
  ];

  for (const market of markets) {
    const result = await prisma.market.upsert({
      where: { symbol: market.symbol },
      create: {
        symbol: market.symbol,
        baseAssetId: assetIds[market.base],
        quoteAssetId: assetIds[market.quote],
      },
      update: {
        baseAssetId: assetIds[market.base],
        quoteAssetId: assetIds[market.quote],
      },
    });
    console.log(`Market ${market.symbol} (${result.id})`);
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
