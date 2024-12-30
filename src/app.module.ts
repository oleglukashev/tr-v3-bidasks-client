import { Module } from '@nestjs/common';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { StrategiesEntityService } from './modules/entity-services/strategies-entity-service';
import { StrategySessionsEntityService } from './modules/entity-services/strategy-sessions-entity-service';
import { PrismaService } from './prisma.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DhmStrategyModule } from './modules/strategies/dhm/dhm.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { O1StrategyModule } from "./modules/strategies/o1/o1.module";
import { OrdersEntityService } from "./modules/entity-services/orders-entity-service";

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
    PrismaService,
    //Entity
    PairsEntityService,
    OrdersEntityService,
    StrategiesEntityService,
    StrategySessionsEntityService,
  ],
})
export class AppModule {}
