import { Global, Module } from '@nestjs/common';
import { PairsEntityService } from './pairs-entity-service';
import { OrdersEntityService } from './orders-entity-service';
import { KlinesEntityService } from './klines-entity-service';

@Global()
@Module({
  providers: [PairsEntityService, OrdersEntityService, KlinesEntityService],
  exports: [PairsEntityService, OrdersEntityService, KlinesEntityService],
})
export class EntityModule {}
