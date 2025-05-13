import { Global, Module } from '@nestjs/common';
import { KlinesEntityService } from './klines-entity-service';

@Global()
@Module({
  providers: [KlinesEntityService],
  exports: [KlinesEntityService],
})
export class EntityModule {}
