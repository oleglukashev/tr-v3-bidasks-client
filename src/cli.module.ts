import { Module } from '@nestjs/common';
import { MexcModule } from './modules/trading-services/mexc/mexc.module';
import { MexcService } from './modules/trading-services/mexc/mexc.service';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { PrismaService } from './prisma.service';
import { KlinesEntityService } from './modules/entity-services/klines-entity-service';
import { DhmStrategyDetectService } from './modules/strategies/dhm/dhm.strategy.detect.service';
import { DhmStrategyModule } from './modules/strategies/dhm/dhm.module';
import { StrategySessionsEntityService } from './modules/entity-services/strategy-sessions-entity-service';
import { DhmStrategyProcessService } from './modules/strategies/dhm/dhm.strategy.process.service';
import { RedisModule } from '@nestjs-modules/ioredis';
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
    MexcModule,
    DhmStrategyModule,
  ],
  providers: [
    DhmStrategyDetectService,
    DhmStrategyProcessService,
    //DhmStrategyHistoryProcessService,
    PrismaService,
    // entites
    PairsEntityService,
    KlinesEntityService,
    StrategySessionsEntityService,
    //BalancesEntityService,
    //BalanceTrxsEntityService,
    MexcService,
    // Commands
    //BuyTestCommand,
  ],
})
export class CliModule {}
