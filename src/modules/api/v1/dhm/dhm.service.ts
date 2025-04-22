import { Injectable } from '@nestjs/common';
import { StrategySessionsEntityService } from '../../../entity-services/strategy-sessions-entity-service';

@Injectable()
export class ApiDhmService {
  constructor(private readonly dhmEntityService: StrategySessionsEntityService) {}
}
