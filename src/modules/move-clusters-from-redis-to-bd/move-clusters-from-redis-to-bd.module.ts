import { Module } from '@nestjs/common';
import { MoveClustersFromRedisToBdCronService } from './move-clusters-from-redis-to-bd.cron.service';

@Module({
  providers: [MoveClustersFromRedisToBdCronService],
  exports: [MoveClustersFromRedisToBdCronService],
})
export class MoveClustersFromRedisToBdModule {}
