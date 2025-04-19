import { Global, Module } from '@nestjs/common';
import { PairsEntityService } from './pairs-entity-service';
import { OrdersEntityService } from './orders-entity-service';
import { StrategiesEntityService } from './strategies-entity-service';
import { StrategySessionsEntityService } from './strategy-sessions-entity-service';

@Global()
@Module({
  providers: [
    PairsEntityService,
    OrdersEntityService,
    StrategiesEntityService,
    StrategySessionsEntityService,
  ],
  exports: [
    PairsEntityService,
    OrdersEntityService,
    StrategiesEntityService,
    StrategySessionsEntityService,
  ],
})
export class EntityModule {}
