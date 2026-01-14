import { Global, Module } from '@nestjs/common';
import { KlinesPrismaService } from './klinesPrisma.service';

@Global()
@Module({
  providers: [KlinesPrismaService],
  exports: [KlinesPrismaService],
})
export class KlinesPrismaModule {}
