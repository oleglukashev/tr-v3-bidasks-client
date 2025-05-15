import { Global, Module } from '@nestjs/common';
import { ClustersEntityService } from './clusters-entity-service';
import { FppEntityService } from './fpp-entity-service';

@Global()
@Module({
  providers: [ClustersEntityService, FppEntityService],
  exports: [ClustersEntityService, FppEntityService],
})
export class EntityModule {}
