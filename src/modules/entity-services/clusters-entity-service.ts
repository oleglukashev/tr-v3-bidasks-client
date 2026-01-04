import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseEntityService } from './base.service';
import { getStartTsByTf } from '../../utils/time';
import {
  getCluster,
  getClusterKeyByPairIdTsTf,
  saveCluster,
} from '../../utils/redis';

@Injectable()
export class ClustersEntityService extends BaseEntityService {
  constructor(clustersPrismaService: PrismaService) {
    super(clustersPrismaService, 'cluster');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }

  async processTrade(trade, tf, pairId, redis, clusterSize) {
    console.log(111);
    const startTs = getStartTsByTf(trade.timestamp, tf);
    console.log(112, typeof startTs);
    const priceCluster = this.getPriceCluster(trade, clusterSize);
    console.log(113);
    // if no startTs in clusters clear this tf clusters and create new cluster
    // if (!this.clusters[pairId][tf]?.[startTs]) {
    const clusterKey = getClusterKeyByPairIdTsTf(pairId, tf, startTs);
    console.log(114);
    let cluster: any = await getCluster(clusterKey, redis);
    console.log(115);
    //let cluster: any = await this.redis.hgetall(clusterKey);
    if (!cluster?.id) {
      // this.clusters[pairId][tf] = {};

      try {
        // this.clusters[pairId][tf][startTs] =
        //   await this.clustersEntityService.baseCreate({
        //     data: {},
        //     ts: startTs,
        //     pairId: parseInt(pairId),
        //     tf: parseInt(tf),
        //   });
        console.log(1);
        cluster = await this.baseCreate({
          data: {},
          ts: startTs,
          pairId: parseInt(pairId),
          tf: tf,
        });
        console.log(2);
        await saveCluster(clusterKey, cluster, redis);
        //await this.redis.hmset(clusterKey, JSON.stringify(cluster));
      } catch (e) {
        // this.clusters[pairId][tf][startTs] =
        //   await this.clustersEntityService.findFirst({
        //     where: {
        //       ts: { equals: startTs },
        //       pairId: { equals: parseInt(pairId) },
        //       tf: { equals: parseInt(tf) },
        //     },
        //   });
        console.log('startTs', startTs);
        cluster = await this.findFirst({
          where: {
            ts: { equals: startTs },
            pairId: { equals: parseInt(pairId) },
            tf: { equals: tf },
          },
        });
        await saveCluster(clusterKey, cluster, redis);
        //await this.redis.hmset(clusterKey, cluster);
        console.log(e);
      }
    }

    if (!cluster.data?.[priceCluster]) {
      cluster.data[priceCluster] = this.getDefaultClusterData(priceCluster);
    }

    const priceClusterData: any = this.updatePriceClusterData(
      cluster.data[priceCluster],
      trade,
    );

    const tradeVolume = trade.amount;
    cluster.v += parseInt(tradeVolume);
    cluster.data[priceCluster] = priceClusterData;

    try {
      // await this.clustersEntityService.baseUpdate(
      //   this.clusters[pairId][tf][startTs].id,
      //   {
      //     v: this.clusters[pairId][tf][startTs].v,
      //     data: this.clusters[pairId][tf][startTs].data,
      //   },
      // );
      await saveCluster(clusterKey, cluster, redis);
      // await this.redis.hmset(
      //   `clusters:${pairId}:${tf}:${startTs}`,
      //   JSON.stringify(cluster),
      // );
    } catch (e) {
      console.log(e);
    }
  }

  private getPriceCluster(trade: any, clusterSize: number) {
    const priceCluster: number =
      Math.ceil(parseFloat(trade.price) / clusterSize) * clusterSize;
    const signsAfterPoint = clusterSize.toString().split('.')?.[1]?.length || 0;
    return Number(priceCluster.toFixed(signsAfterPoint));
  }

  private getDefaultClusterData(priceCluster: any) {
    return {
      p: priceCluster.toString(),
      v: 0,
      bv: 0,
      sv: 0,
    };
  }

  private updatePriceClusterData(priceClusterData: any, trade: any) {
    const tradeVolume = trade.amount;
    const result: any = { ...priceClusterData };
    result.v = Number(
      (parseFloat(priceClusterData.v) + parseFloat(tradeVolume)).toFixed(2),
    ).toString();
    if (trade.side === 'buy') {
      result.bv = Number(
        (parseFloat(priceClusterData.bv) + parseFloat(tradeVolume)).toFixed(2),
      ).toString();
    } else if (trade.side === 'sell') {
      result.sv = Number(
        (parseFloat(priceClusterData.sv) + parseFloat(tradeVolume)).toFixed(2),
      ).toString();
    }
    return result;
  }
}
