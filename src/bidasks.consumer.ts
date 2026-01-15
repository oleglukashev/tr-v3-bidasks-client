import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ClustersEntityService } from './modules/entity-services/clusters-entity-service';

@Processor('bidasks')
export class BidasksConsumer {
  constructor(
    @InjectRedis('bidasksDb') private readonly redis: Redis,
    private readonly clustersEntityService: ClustersEntityService,
  ) {}

  @Process('processTrade')
  async processTrade(job: Job<any>) {
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
