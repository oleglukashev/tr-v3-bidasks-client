import { Module } from '@nestjs/common';
import { DhmStrategyDetectCronService } from './dhm.strategy.detect.cron.service';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { DhmStrategyProcessCronService } from './dhm.strategy.process.cron.service';
// import { StrategySessionTrxsEntityService } from '../../entity-services/strategy-session-trxs-entity-service';
import { DhmStrategyDetectService } from './dhm.strategy.detect.service';
import { DhmStrategyProcessService } from './dhm.strategy.process.service';
// import { BalanceTrxsEntityService } from '../../entity-services/balance-trxs-entity-service';
// import { BalancesEntityService } from '../../entity-services/balances-entity-service';
// import { DhmStrategyHistoryProcessService } from './dhm.strategy.history.process.service';
// import { HistoryStrategySessionsEntityService } from '../../entity-services/history-strategy-sessions-entity-service';

@Module({
  imports: [],
  providers: [
    KlinesEntityService,
    //HistoryStrategySessionsEntityService,
    StrategySessionsEntityService,
    //StrategySessionTrxsEntityService,
    DhmStrategyDetectCronService,
    DhmStrategyProcessCronService,
    DhmStrategyDetectService,
    DhmStrategyProcessService,
    //DhmStrategyHistoryProcessService,
    //BalancesEntityService,
    //BalanceTrxsEntityService,
  ],
})
export class DhmStrategyModule {}
