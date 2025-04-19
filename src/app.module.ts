import { Module } from '@nestjs/common';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { StrategiesEntityService } from './modules/entity-services/strategies-entity-service';
import { StrategySessionsEntityService } from './modules/entity-services/strategy-sessions-entity-service';
import { ScheduleModule } from '@nestjs/schedule';
import { DhmStrategyModule } from './modules/strategies/dhm/dhm.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { OrdersEntityService } from './modules/entity-services/orders-entity-service';
import { GeneralPrismaModule } from './modules/generalPrisma/generalPrisma.module';
import { KlinesPrismaModule } from './modules/klinesPrisma/klinesPrisma.module';

@Module({
  imports: [
    GeneralPrismaModule,
    KlinesPrismaModule,
    RedisModule.forRoot(
      {
        type: 'single',
        url: 'redis://localhost:6379',
        options: { db: 3 },
      },
      'priceDb',
    ),
    RedisModule.forRoot(
      {
        type: 'single',
        url: 'redis://localhost:6379',
        options: { db: 4 },
      },
      'sessionDb',
    ),
    ScheduleModule.forRoot(),
    // BullModule.forRoot({
    //   prefix: 'tr-v2',
    //   redis: {
    //     host: 'localhost',
    //     port: 6379,
    //   },
    // }),
    // Strategies
    DhmStrategyModule,
    //O1StrategyModule,
  ],
  controllers: [],
  providers: [
    //Entity
    PairsEntityService,
    OrdersEntityService,
    StrategiesEntityService,
    StrategySessionsEntityService,
  ],
})
export class AppModule {}
