import { Injectable } from '@nestjs/common';
import { GeneralPrismaService } from '../generalPrisma/generalPrisma.service';
import { BaseEntityService } from './base.service';

@Injectable()
export class StrategiesEntityService extends BaseEntityService {
  constructor(prismaService: GeneralPrismaService) {
    super(prismaService, 'strategy');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
