import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { EntityModule } from './modules/entity-services/entities.module';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { ApiClustersModule } from './modules/api/v1/clusters/clusters.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    EntityModule,
    PrismaModule,
    ApiClustersModule,
  ],
  providers: [AppService],
})
export class AppModule {}
