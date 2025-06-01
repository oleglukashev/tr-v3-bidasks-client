import { Injectable } from '@nestjs/common';
import { ClustersEntityService } from '../entity-services/clusters-entity-service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import moment from 'moment/moment';

@Injectable()
export class MoveClustersFromRedisToBdService {
  constructor(
    private readonly clustersEntityService: ClustersEntityService,
    @InjectRedis('bidasksDb') private readonly redis: Redis,
  ) {}

  async run(tf: number) {
    const startTs = moment()
      .utc()
      .startOf('minute')
      .subtract(tf * 5, 'minute')
      .valueOf();

    const clusters = await this.clustersEntityService.findMany({
      where: {
        ts: { equals: startTs },
        tf: { equals: tf },
      },
    });

    for (const cluster of clusters) {
      const redisItem: any = await this.redis.get(
        `clusters:pairId_${cluster.pairId}:tf_${cluster.tf}:startTs_${cluster.ts}`,
      );

      if (redisItem) {
        await this.clustersEntityService.baseUpdate(cluster.id, {
          ...redisItem,
          id: undefined,
        });
        await this.redis.del(
          `clusters:pairId_${cluster.pairId}:tf_${cluster.tf}:startTs_${cluster.ts}`,
        );
      }
    }
  }
}
