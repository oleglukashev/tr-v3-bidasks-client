import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ClustersEntityService } from './modules/entity-services/clusters-entity-service';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('bidasks', { concurrency: 20 })
export class BidasksConsumer extends WorkerHost {
  constructor(
    @InjectRedis('bidasksDb') private readonly redis: Redis,
    private readonly clustersEntityService: ClustersEntityService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    const trade = job.data.trade;
    const tf = job.data.tf;
    const pairId = job.data.pairId;
    const clusterSize = job.data.clusterSize;

    await this.clustersEntityService.processTrade(
      trade,
      tf,
      pairId,
      this.redis,
      clusterSize,
    );
  }
}
