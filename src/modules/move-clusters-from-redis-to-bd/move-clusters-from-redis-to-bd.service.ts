import { Injectable } from '@nestjs/common';
import { ClustersEntityService } from '../entity-services/clusters-entity-service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import moment from 'moment/moment';
import { getCluster, getClusterKeyByPairIdTsTf } from '../../utils/redis';

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
      const clusterKey = getClusterKeyByPairIdTsTf(
        cluster.pairId,
        cluster.tf,
        cluster.ts,
      );
      const redisItem: any = await getCluster(clusterKey, this.redis);

      if (redisItem) {
        await this.clustersEntityService.baseUpdate(cluster.id, {
          ...redisItem,
          id: undefined,
        });
        await this.redis.del(clusterKey);
      }
    }
  }
}
