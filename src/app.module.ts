import { Module } from '@nestjs/common';
import { EntityModule } from './modules/entity-services/entities.module';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { ApiClustersModule } from './modules/api/v1/clusters/clusters.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiFppModule } from './modules/api/v1/fpp/fpp.module';
import { GeneralPrismaModule } from './modules/generalPrisma/generalPrisma.module';
import { BidasksPrismaModule } from './modules/bidasksPrisma/bidasksPrisma.module';
import { WebsocketGatewayModule } from './modules/websocket-gateway/websocket-gateway.module';
import { BidasksStorageModule } from './modules/bidasks-storage/bidasks-storage.module';

@Module({
  imports: [
    GeneralPrismaModule,
    BidasksPrismaModule,
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    EntityModule,
    ApiClustersModule,
    ApiFppModule,
    WebsocketGatewayModule,
    BidasksStorageModule,
  ],
  providers: [AppService],
})
export class AppModule {}
