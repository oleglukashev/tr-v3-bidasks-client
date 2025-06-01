import { Injectable } from '@nestjs/common';
import moment from 'moment';
import { getStartTsByTf } from '../../utils/time';
import { direction, pocFromCluster } from '../../utils/kline';
import { ClustersEntityService } from '../entity-services/clusters-entity-service';
import { FppEntityService } from '../entity-services/fpp-entity-service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { getClusterKeyByPairIdTsTf } from '../../utils/redis';

@Injectable()
export class GenerateFppService {
  constructor(
    private readonly clustersEntityService: ClustersEntityService,
    private readonly fppEntityService: FppEntityService,
    @InjectRedis('bidasksDb') private readonly redis: Redis,
  ) {}

  async processFpp(pairId: number, tf: number) {
    const cluster2Ts = moment()
      .utc()
      .startOf('minute')
      .subtract(tf, 'minute')
      .valueOf();
    const cluster1Ts = moment()
      .utc()
      .startOf('minute')
      .subtract(2 * tf, 'minute')
      .valueOf();

    const cluster2: any = await this.redis.hgetall(
      getClusterKeyByPairIdTsTf(pairId, tf, cluster2Ts),
    );
    const cluster1: any = await this.redis.hgetall(
      getClusterKeyByPairIdTsTf(pairId, tf, cluster1Ts),
    );

    // const cluster2 = await this.clustersEntityService.findFirst({
    //   where: {
    //     ts: { equals: getStartTsByTf(cluster2Ts, tf) },
    //     pairId: { equals: pairId },
    //     tf: { equals: tf },
    //   },
    // });
    //
    // const cluster1 = await this.clustersEntityService.findFirst({
    //   where: {
    //     ts: { equals: getStartTsByTf(cluster1Ts, tf) },
    //     pairId: { equals: pairId },
    //     tf: { equals: tf },
    //   },
    // });

    if (!cluster1 || !cluster2) {
      console.log(`${pairId},${tf}: Not enough clusters data`);
      return;
    }

    const kline1Res = await fetch(this.getKlinePath(pairId, cluster1.ts, tf));
    const kline2Res = await fetch(this.getKlinePath(pairId, cluster2.ts, tf));
    const kline1 = await kline1Res.json();
    const kline2 = await kline2Res.json();
    await this.processInterceptionPattern(
      cluster1,
      cluster2,
      kline1,
      kline2,
      pairId,
      tf,
    );
  }

  private async processInterceptionPattern(
    cluster1: any,
    cluster2: any,
    kline1: any,
    kline2: any,
    pairId: number,
    tf: number,
  ) {
    if (!kline1 || !kline2) {
      console.log(`${pairId},${tf}: Not enough klines data`);
    }

    const cluster1Poc: any = pocFromCluster(cluster1);
    const cluster2Poc: any = pocFromCluster(cluster2);

    if (!cluster1Poc || !cluster2Poc) {
      console.log(`${pairId},${tf}: Not enough poc data`);
    }

    const kline1Direction = direction(kline1);
    const kline2Direction = direction(kline2);

    if (kline1Direction !== kline2Direction) {
      if (kline1Direction === 'up') {
        // down reverse
        console.log(
          'c1 poc > k1 close',
          parseFloat(cluster1Poc.p) > parseFloat(kline1.close),
        );
        console.log(
          'c2 poc > k2 close',
          parseFloat(cluster2Poc.p) > parseFloat(kline2.close),
        );
        if (
          parseFloat(cluster1Poc.p) > parseFloat(kline1.close) &&
          parseFloat(cluster2Poc.p) > parseFloat(kline2.close)
        ) {
          await this.fppEntityService.baseCreate({
            ts: kline2.ts,
            pairId,
            tf,
            direction: 'down',
          });
        }
      } else {
        // up reverse
        console.log(
          'c1 poc < k1 close',
          parseFloat(cluster1Poc.p) < parseFloat(kline1.close),
        );
        console.log(
          'c2 poc < k2 close',
          parseFloat(cluster2Poc.p) < parseFloat(kline2.close),
        );
        if (
          parseFloat(cluster1Poc.p) < parseFloat(kline1.close) &&
          parseFloat(cluster2Poc.p) < parseFloat(kline2.close)
        ) {
          await this.fppEntityService.baseCreate({
            ts: kline2.ts,
            pairId,
            tf,
            direction: 'up',
          });
        }
      }
    }
    console.log('kline1', kline1);
    console.log('kline2', kline2);
    console.log('cluster1Poc', cluster1Poc);
    console.log('cluster2Poc', cluster2Poc);
  }

  private getKlinePath(pairId: number, ts: number, tf: number) {
    return `http://klines.traken-trade.ru/api/v1/klines/by_pair_id_and_tf_and_ts?pairId=${pairId}&ts=${ts}&tf=${tf}`;
  }
}
