import { Prisma } from '@prisma/client';

export type TransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;
