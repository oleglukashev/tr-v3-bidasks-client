import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseEntityService } from './base.service';

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
}
