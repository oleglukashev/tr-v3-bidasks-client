import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { EntityModule } from './modules/entity-services/entities.module';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { ApiClustersModule } from './modules/api/v1/clusters/clusters.module';
import { GenerateFppModule } from './modules/api/generate-fpp/generate-fpp.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    EntityModule,
    PrismaModule,
    GenerateFppModule,
    ApiClustersModule,
  ],
  providers: [AppService],
})
export class AppModule {}
