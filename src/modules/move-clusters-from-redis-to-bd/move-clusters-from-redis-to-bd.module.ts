import { Module } from '@nestjs/common';
import { MoveClustersFromRedisToBdService } from './move-clusters-from-redis-to-bd.service';
import { MoveClustersFromRedisToBdCronService } from './move-clusters-from-redis-to-bd.cron.service';

@Module({
  providers: [
    MoveClustersFromRedisToBdService,
    MoveClustersFromRedisToBdCronService,
  ],
  exports: [
    MoveClustersFromRedisToBdService,
    MoveClustersFromRedisToBdCronService,
  ],
})
export class MoveClustersFromRedisToBdModule {}
