import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DhmStrategyProcessService } from './dhm.strategy.process.service';
import * as process from 'node:process';

@Injectable()
export class DhmStrategyProcessCronService {
  constructor(
    private readonly dhmStrategyProcessService: DhmStrategyProcessService,
  ) {}

  @Cron('*/15 * * * * *')
  async handleCron() {
    await this.dhmStrategyProcessService.process(true);
  }
}
