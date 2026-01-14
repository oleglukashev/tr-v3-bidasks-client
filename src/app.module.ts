import { Module } from '@nestjs/common';
import { EntityModule } from './modules/entity-services/entities.module';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { ApiClustersModule } from './modules/api/v1/clusters/clusters.module';
import { GenerateFppModule } from './modules/generate-fpp/generate-fpp.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiFppModule } from './modules/api/v1/fpp/fpp.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { MoveClustersFromRedisToBdModule } from './modules/move-clusters-from-redis-to-bd/move-clusters-from-redis-to-bd.module';
import { GeneralPrismaModule } from './modules/generalPrisma/generalPrisma.module';
//import { KlinesPrismaModule } from './modules/klinesPrisma/klinesPrisma.module';
import { BidasksPrismaModule } from './modules/bidasksPrisma/bidasksPrisma.module';

@Module({
  imports: [
    GeneralPrismaModule,
    //KlinesPrismaModule,
    BidasksPrismaModule,
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    RedisModule.forRoot(
      {
        type: 'single',
        url: 'redis://localhost:6379',
        options: { db: 5 },
      },
      'bidasksDb',
    ),
    EntityModule,
    GenerateFppModule,
    MoveClustersFromRedisToBdModule,
    ApiClustersModule,
    ApiFppModule,
  ],
  providers: [AppService],
})
export class AppModule {}
