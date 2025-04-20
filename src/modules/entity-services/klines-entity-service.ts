import { Injectable } from '@nestjs/common';
import { KlinesPrismaService } from '../klinesPrisma/klinesPrisma.service';
import { BaseEntityService } from './base.service';

@Injectable()
export class KlinesEntityService extends BaseEntityService {
  constructor(klinesPrismaService: KlinesPrismaService) {
    super(klinesPrismaService, 'kline');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
