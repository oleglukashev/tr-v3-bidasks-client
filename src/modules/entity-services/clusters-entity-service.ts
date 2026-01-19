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
      console.log('createOrUpdateBidask error', e, e.code);
      if (e.code === 'P2002') {
        const existBidask = await this.findFirst({
          where: {
            ts: bidask.ts,
            pairId: bidask.pairId,
            tf: bidask.tf,
          },
        });
        console.log('existBidask', existBidask);
        console.log('bidask', bidask);
        if (existBidask) {
          await this.baseUpdate(existBidask.id, {
            data: bidask.data,
            v: existBidask.v,
          });
        }
      }
    }
  }
}
