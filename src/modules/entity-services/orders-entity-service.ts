import { Injectable } from '@nestjs/common';
import { GeneralPrismaService } from '../generalPrisma/generalPrisma.service';
import { BaseEntityService } from './base.service';

@Injectable()
export class OrdersEntityService extends BaseEntityService {
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
