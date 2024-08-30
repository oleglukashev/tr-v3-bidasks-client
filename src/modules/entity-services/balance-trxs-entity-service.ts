import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Base } from './base.service';
import { BalancesEntityService } from "./balances-entity-service";

@Injectable()
export class BalanceTrxsEntityService extends Base {
  constructor(
    private readonly balancesEntityService: BalancesEntityService,
    prismaService: PrismaService
  ) {
    super(prismaService, 'balanceTrx');
  }

  public override async preBaseCreate(data) {
    const balance = await this.balancesEntityService.findFirst({ where: { id: data.balanceId } });

    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
