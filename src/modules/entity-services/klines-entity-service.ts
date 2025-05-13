import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseEntityService } from './base.service';

@Injectable()
export class KlinesEntityService extends BaseEntityService {
  constructor(klinesPrismaService: PrismaService) {
    super(klinesPrismaService, 'kline');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
