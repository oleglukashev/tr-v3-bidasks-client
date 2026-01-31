import { Injectable } from '@nestjs/common';
import { Base } from './base.service';
import { BidasksPrismaService } from '../bidasksPrisma/bidasksPrisma.service';

@Injectable()
export class ClustersEntityService extends Base {
  constructor(clustersPrismaService: BidasksPrismaService) {
    super(clustersPrismaService, 'cluster');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
