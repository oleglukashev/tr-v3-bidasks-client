import { Module } from '@nestjs/common';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { StrategiesEntityService } from './modules/entity-services/strategies-entity-service';
import { StrategySessionsEntityService } from './modules/entity-services/strategy-sessions-entity-service';
import { PrismaService } from './prisma.service';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { DhmStrategyModule } from './modules/strategies/dhm/dhm.module';
import { RedisModule } from '@nestjs-modules/ioredis';

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
  ],
  controllers: [],
  providers: [
    PrismaService,
    //Entity
    PairsEntityService,
    StrategiesEntityService,
    StrategySessionsEntityService,
  ],
})
export class AppModule {}
