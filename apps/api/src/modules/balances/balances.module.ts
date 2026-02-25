import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { BalanceService } from "./balances.service";

@Module({
  imports: [LedgerModule],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalancesModule {}
