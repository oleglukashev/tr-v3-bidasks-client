import { Module } from '@nestjs/common';
import { GeneralPrismaModule } from './modules/generalPrisma/generalPrisma.module';
import { KlinesPrismaModule } from './modules/klinesPrisma/klinesPrisma.module';
import { ApiKlinesModule } from './modules/api/v1/klines/klines.module';
import { EntityModule } from './modules/entity-services/entities.module';

@Module({
  imports: [
    EntityModule,
    GeneralPrismaModule,
    KlinesPrismaModule,
    ApiKlinesModule,
  ],
  providers: [],
})
export class AppModule {}
