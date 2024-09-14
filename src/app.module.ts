import { Module } from '@nestjs/common';
import { TradingServicesEntityService } from './modules/entity-services/trading-services-entity-service';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { StrategiesEntityService } from './modules/entity-services/strategies-entity-service';
import { StrategySessionsEntityService } from './modules/entity-services/strategy-sessions-entity-service';
import { StrategySessionTrxsEntityService } from './modules/entity-services/strategy-session-trxs-entity-service';
import { BalancesEntityService } from './modules/entity-services/balances-entity-service';
import { PrismaService } from './prisma.service';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { DhmStrategyModule } from './modules/strategies/dhm/dhm.module';
import { TickerPricesModule } from './modules/ticker-prices/ticker-prices.module';
import { BalanceTrxsEntityService } from './modules/entity-services/balance-trxs-entity-service';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ApiHistoryStrategySessionsModule } from './modules/api/v1/history-strategy-sessions/history-strategy-sessions.module';
import { ApiKlinesModule } from './modules/api/v1/klines/klines.module';

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
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      prefix: 'tr-v2',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'klineGrabber',
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    TickerPricesModule,
    // Strategies
    DhmStrategyModule,
    ApiHistoryStrategySessionsModule,
    ApiKlinesModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    //Entity
    TradingServicesEntityService,
    PairsEntityService,
    StrategiesEntityService,
    StrategySessionsEntityService,
    StrategySessionTrxsEntityService,
    BalancesEntityService,
    BalanceTrxsEntityService,
  ],
})
export class AppModule {}
