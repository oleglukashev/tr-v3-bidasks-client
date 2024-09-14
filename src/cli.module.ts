import { Module } from '@nestjs/common';
import { TickerPricesModule } from './modules/ticker-prices/ticker-prices.module';
import { TickerPricesService } from './modules/ticker-prices/ticker-prices.service';
import { MexcModule } from './modules/trading-services/mexc/mexc.module';
import { PricesGrabber1hCommand } from './commands/prices-grabber-1h.command';
import { MexcService } from './modules/trading-services/mexc/mexc.service';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { PrismaService } from './prisma.service';
import { KlinesEntityService } from './modules/entity-services/klines-entity-service';
import { DhmStrategyTestCommand } from './commands/dhm.strategy.test.command';
import { DhmStrategyDetectService } from './modules/strategies/dhm/dhm.strategy.detect.service';
import { DhmStrategyModule } from './modules/strategies/dhm/dhm.module';
import { StrategySessionsEntityService } from './modules/entity-services/strategy-sessions-entity-service';
import { DhmStrategyProcessService } from './modules/strategies/dhm/dhm.strategy.process.service';
import { StrategySessionTrxsEntityService } from './modules/entity-services/strategy-session-trxs-entity-service';
import { BalancesEntityService } from './modules/entity-services/balances-entity-service';
import { BalanceTrxsEntityService } from './modules/entity-services/balance-trxs-entity-service';
import { DhmStrategyHistoryProcessService } from './modules/strategies/dhm/dhm.strategy.history.process.service';
import { RedisModule } from '@nestjs-modules/ioredis';
import { HistoryStrategySessionsEntityService } from './modules/entity-services/history-strategy-sessions-entity-service';
//import { BuyTestCommand } from "./commands/buy-test.odata.command";

@Module({
  imports: [
    RedisModule.forRoot(
      {
        type: 'single',
        url: 'redis://localhost:6379',
        options: {
          db: 3,
        },
      },
      'priceDb',
    ),
    RedisModule.forRoot(
      {
        type: 'single',
        url: 'redis://localhost:6379',
        options: {
          db: 4,
        },
      },
      'sessionDb',
    ),
    TickerPricesModule,
    MexcModule,
    DhmStrategyModule,
  ],
  providers: [
    DhmStrategyDetectService,
    DhmStrategyProcessService,
    DhmStrategyHistoryProcessService,
    PrismaService,
    // entites
    PairsEntityService,
    KlinesEntityService,
    TickerPricesService,
    HistoryStrategySessionsEntityService,
    StrategySessionsEntityService,
    StrategySessionTrxsEntityService,
    BalancesEntityService,
    BalanceTrxsEntityService,
    MexcService,
    // Commands
    PricesGrabber1hCommand,
    DhmStrategyTestCommand,
    //BuyTestCommand,
  ],
})
export class CliModule {}
