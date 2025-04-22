import { Global, Module } from '@nestjs/common';
import { PairsEntityService } from './pairs-entity-service';
import { OrdersEntityService } from './orders-entity-service';
import { KlinesEntityService } from './klines-entity-service';
import { StrategySessionsEntityService } from './strategy-sessions-entity-service';

@Global()
@Module({
  providers: [
    PairsEntityService,
    OrdersEntityService,
    KlinesEntityService,
    StrategySessionsEntityService,
  ],
  exports: [
    PairsEntityService,
    OrdersEntityService,
    KlinesEntityService,
    StrategySessionsEntityService,
  ],
})
export class EntityModule {}
