import { Injectable } from '@nestjs/common';
import { BaseEntityService } from './base.service';
import { GeneralPrismaService } from '../generalPrisma/generalPrisma.service';

@Injectable()
export class StrategySessionsEntityService extends BaseEntityService {
  constructor(generalPrismaService: GeneralPrismaService) {
    super(generalPrismaService, 'strategySession');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
