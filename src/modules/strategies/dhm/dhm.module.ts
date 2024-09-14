import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { DhmStrategyService } from './dhm.strategy.service';
import { DhmStrategyDetectCronService } from './dhm.strategy.detect.cron.service';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { TickerPricesModule } from '../../ticker-prices/ticker-prices.module';
import { TickerPricesService } from '../../ticker-prices/ticker-prices.service';
import { DhmStrategyProcessCronService } from './dhm.strategy.process.cron.service';
import { StrategySessionTrxsEntityService } from '../../entity-services/strategy-session-trxs-entity-service';
import { MexcModule } from '../../trading-services/mexc/mexc.module';
import { MexcService } from '../../trading-services/mexc/mexc.service';
import { DhmStrategyDetectService } from './dhm.strategy.detect.service';
import { DhmStrategyProcessService } from './dhm.strategy.process.service';
import { BalanceTrxsEntityService } from '../../entity-services/balance-trxs-entity-service';
import { BalancesEntityService } from '../../entity-services/balances-entity-service';
import { DhmStrategyHistoryProcessService } from './dhm.strategy.history.process.service';
import { HistoryStrategySessionsEntityService } from '../../entity-services/history-strategy-sessions-entity-service';

@Module({
  imports: [TickerPricesModule, MexcModule],
  providers: [
    PrismaService,
    DhmStrategyService,
    KlinesEntityService,
    HistoryStrategySessionsEntityService,
    StrategySessionsEntityService,
    StrategySessionTrxsEntityService,
    DhmStrategyDetectCronService,
    DhmStrategyProcessCronService,
    DhmStrategyDetectService,
    DhmStrategyProcessService,
    DhmStrategyHistoryProcessService,
    TickerPricesService,
    MexcService,
    BalancesEntityService,
    BalanceTrxsEntityService,
  ],
})
export class DhmStrategyModule {}
