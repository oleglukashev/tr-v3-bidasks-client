import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ApiKlinesModule } from './modules/api/v1/klines/klines.module';
import { EntityModule } from './modules/entity-services/entities.module';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    EntityModule,
    PrismaModule,
    ApiKlinesModule,
  ],
  providers: [AppService],
})
export class AppModule {}
