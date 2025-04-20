import { Injectable } from '@nestjs/common';
import { KlinesEntityService } from '../../../entity-services/klines-entity-service';

@Injectable()
export class ApiKlinesService {
  constructor(private readonly klinesEntityService: KlinesEntityService) {}
}
