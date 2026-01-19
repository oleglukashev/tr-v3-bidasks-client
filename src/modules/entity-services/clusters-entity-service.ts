import { Injectable } from '@nestjs/common';
import { Base } from './base.service';
import { BidasksPrismaService } from '../bidasksPrisma/bidasksPrisma.service';
import { BidasksStorageService } from '../bidasks-storage/bidasks-storage.service';

@Injectable()
export class ClustersEntityService extends Base {
  constructor(
    clustersPrismaService: BidasksPrismaService,
    private readonly bidasksStorageService: BidasksStorageService,
  ) {
    super(clustersPrismaService, 'cluster');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }

  async moveBidasksFromStorageToBdByTf(tf: number) {
    const storageBidasks = this.bidasksStorageService.finished(tf);

    for (const bidask of storageBidasks) {
      await this.createOrUpdateBidask(bidask);
      this.bidasksStorageService.deleteByBidask(bidask);
    }
  }

  async createOrUpdateBidask(bidask: any) {
    try {
      await this.baseCreate(bidask);
    } catch (e: any) {
      if (e.code === 'P2002') {
        const existBidask = await this.findFirst({
          where: {
            ts: bidask.ts,
            pairId: bidask.pairId,
            tf: bidask.tf,
          },
        });
        if (existBidask) {
          await this.baseUpdate(existBidask.id, {
            data: bidask.data,
            v: existBidask.v,
          });
        }
      }
    }
  }

  // async moveClusterFromRedisToBdByTf(tf: number, currentTs?: number) {
  //   const startTs = moment(currentTs)
  //     .utc()
  //     .startOf('minute')
  //     .subtract(tf * 5, 'minute')
  //     .valueOf();
  //
  //   const clusters = await this.findMany({
  //     where: {
  //       ts: { equals: startTs },
  //       tf: { equals: tf },
  //     },
  //   });
  //
  //   for (const cluster of clusters) {
  //     const clusterKey = getClusterKeyByPairIdTsTf(
  //       cluster.pairId,
  //       cluster.tf,
  //       cluster.ts,
  //     );
  //     const redisItem: any = await getCluster(clusterKey, this.redis);
  //
  //     if (redisItem) {
  //       await this.baseUpdate(cluster.id, {
  //         ...redisItem,
  //         id: undefined,
  //       });
  //       await this.redis.del(clusterKey);
  //     }
  //   }
  // }

  // getPriceCluster(trade: any, clusterSize: number) {
  //   const priceCluster: number =
  //     Math.ceil(parseFloat(trade.price) / clusterSize) * clusterSize;
  //   const signsAfterPoint = clusterSize.toString().split('.')?.[1]?.length || 0;
  //   return Number(priceCluster.toFixed(signsAfterPoint));
  // }
  //
  // getDefaultClusterData(priceCluster: any) {
  //   return {
  //     p: priceCluster.toString(),
  //     v: 0,
  //     bv: 0,
  //     sv: 0,
  //   };
  // }

  // updatePriceClusterData(priceClusterData: any, trade: any) {
  //   const tradeVolume = trade.amount;
  //   const result: any = { ...priceClusterData };
  //   result.v = Number(
  //     (parseFloat(priceClusterData.v) + parseFloat(tradeVolume)).toFixed(2),
  //   ).toString();
  //   if (trade.side === 'buy') {
  //     result.bv = Number(
  //       (parseFloat(priceClusterData.bv) + parseFloat(tradeVolume)).toFixed(2),
  //     ).toString();
  //   } else if (trade.side === 'sell') {
  //     result.sv = Number(
  //       (parseFloat(priceClusterData.sv) + parseFloat(tradeVolume)).toFixed(2),
  //     ).toString();
  //   }
  //   return result;
  // }
}
