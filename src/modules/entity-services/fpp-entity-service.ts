import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseEntityService } from './base.service';

@Injectable()
export class FppEntityService extends BaseEntityService {
  constructor(fppPrismaService: PrismaService) {
    super(fppPrismaService, 'fpp');
  }

  public override async preBaseCreate(data) {
    return data;
  }

  public override async preBaseUpdate(data) {
    return data;
  }
}
