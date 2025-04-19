import { Injectable } from '@nestjs/common';
import { GeneralPrismaService } from '../generalPrisma/generalPrisma.service';
import { Base } from './base.service';

@Injectable()
export class OrdersEntityService extends Base {
  constructor(prismaService: GeneralPrismaService) {
    super(prismaService, 'order');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
