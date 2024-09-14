import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Base } from './base.service';

@Injectable()
export class HistoryStrategySessionsEntityService extends Base {
  constructor(prismaService: PrismaService) {
    super(prismaService, 'historyStrategySession');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
