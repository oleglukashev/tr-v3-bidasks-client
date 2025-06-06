import { Injectable } from '@nestjs/common';
import moment from 'moment';
import {
  delta,
  direction,
  pocFromCluster,
  sortedClusterData,
} from '../../utils/kline';
// import { ClustersEntityService } from '../entity-services/clusters-entity-service';
import { FppEntityService } from '../entity-services/fpp-entity-service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { getCluster, getClusterKeyByPairIdTsTf } from '../../utils/redis';

@Injectable()
export class GenerateFppService {
  constructor(
    // private readonly clustersEntityService: ClustersEntityService,
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
    const cluster2Key = getClusterKeyByPairIdTsTf(pairId, tf, cluster2Ts);
    const cluster1Key = getClusterKeyByPairIdTsTf(pairId, tf, cluster1Ts);
    const cluster2: any = await getCluster(cluster2Key, this.redis);
    const cluster1: any = await getCluster(cluster1Key, this.redis);
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
    // Interception pattern
    await this.processInterceptionPattern(
      cluster1,
      cluster2,
      kline1,
      kline2,
      pairId,
      tf,
    );
    // Reverse pattern
    await this.processReversePattern(
      cluster1,
      cluster2,
      kline1,
      kline2,
      pairId,
      tf,
    );
    // Locked volume
    await this.processLockedVolumePattern(cluster2, kline2, pairId, tf);
    // Locked delta
    await this.processLockedDeltaPattern(cluster2, kline2, pairId, tf);
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
        if (
          parseFloat(cluster1Poc.p) > parseFloat(kline1.close) &&
          parseFloat(cluster2Poc.p) > parseFloat(kline2.close)
        ) {
          await this.fppEntityService.baseCreate({
            ts: kline2.ts,
            pairId,
            tf,
            direction: 'down',
            type: 'interception',
          });
        }
      } else {
        // up reverse
        if (
          parseFloat(cluster1Poc.p) < parseFloat(kline1.close) &&
          parseFloat(cluster2Poc.p) < parseFloat(kline2.close)
        ) {
          await this.fppEntityService.baseCreate({
            ts: kline2.ts,
            pairId,
            tf,
            direction: 'up',
            type: 'interception',
          });
        }
      }
    }
  }

  private async processReversePattern(
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
        if (parseFloat(cluster1Poc.p) > parseFloat(cluster2Poc.p)) {
          await this.fppEntityService.baseCreate({
            ts: kline2.ts,
            pairId,
            tf,
            direction: 'down',
            type: 'reverse',
          });
        }
      } else {
        // up reverse
        if (parseFloat(cluster2Poc.p) > parseFloat(cluster1Poc.p)) {
          await this.fppEntityService.baseCreate({
            ts: kline2.ts,
            pairId,
            tf,
            direction: 'up',
            type: 'reverse',
          });
        }
      }
    }
  }

  private async processLockedVolumePattern(
    cluster: any,
    kline: any,
    pairId: number,
    tf: number,
  ) {
    if (!kline) {
      console.log(`${pairId},${tf}: Not enough kline data`);
    }

    const clusterPoc: any = pocFromCluster(cluster);

    if (!clusterPoc) {
      console.log(`${pairId},${tf}: Not enough poc data`);
    }

    const klineDirection = direction(kline);

    if (klineDirection === 'down') {
      // down reverse
      if (parseFloat(clusterPoc.p) > parseFloat(kline.open)) {
        await this.fppEntityService.baseCreate({
          ts: kline.ts,
          pairId,
          tf,
          direction: 'down',
          type: 'locked_volume',
        });
      }
    } else {
      // up reverse
      if (parseFloat(clusterPoc.p) < parseFloat(kline.open)) {
        await this.fppEntityService.baseCreate({
          ts: kline.ts,
          pairId,
          tf,
          direction: 'up',
          type: 'locked_volume',
        });
      }
    }
  }

  private async processLockedDeltaPattern(
    cluster: any,
    kline: any,
    pairId: number,
    tf: number,
  ) {
    if (!kline) {
      console.log(`${pairId},${tf}: Not enough kline data`);
    }

    const clusterPoc: any = pocFromCluster(cluster);

    if (!clusterPoc) {
      console.log(`${pairId},${tf}: Not enough poc data`);
    }

    const klineDirection = direction(kline);

    if (klineDirection === 'down') {
      // down reverse
      const sortedData = sortedClusterData(cluster, false);
      const firstClusterPriceDelta = parseFloat(delta(sortedData[0]));
      const secondClusterPriceDelta = parseFloat(delta(sortedData[1]));
      const thirdClusterPriceDelta = parseFloat(delta(sortedData[2]));
      if (
        firstClusterPriceDelta > 0 &&
        secondClusterPriceDelta > 0 &&
        thirdClusterPriceDelta > 0 &&
        parseFloat(sortedData[2].p) > parseFloat(kline.open)
      ) {
        await this.fppEntityService.baseCreate({
          ts: kline.ts,
          pairId,
          tf,
          direction: 'down',
          type: 'locked_volume',
        });
      }
    } else {
      // up reverse
      const sortedData = sortedClusterData(cluster, true);
      const firstClusterPriceDelta = parseFloat(delta(sortedData[0]));
      const secondClusterPriceDelta = parseFloat(delta(sortedData[1]));
      const thirdClusterPriceDelta = parseFloat(delta(sortedData[2]));
      if (
        firstClusterPriceDelta < 0 &&
        secondClusterPriceDelta < 0 &&
        thirdClusterPriceDelta < 0 &&
        parseFloat(sortedData[2].p) < parseFloat(kline.open)
      ) {
        await this.fppEntityService.baseCreate({
          ts: kline.ts,
          pairId,
          tf,
          direction: 'up',
          type: 'locked_volume',
        });
      }
    }
  }

  private getKlinePath(pairId: number, ts: number, tf: number) {
    return `http://klines.traken-trade.ru/api/v1/klines/by_pair_id_and_tf_and_ts?pairId=${pairId}&ts=${ts}&tf=${tf}`;
  }
}
