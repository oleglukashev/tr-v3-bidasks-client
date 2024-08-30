import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DhmStrategyProcessService } from './dhm.strategy.process.service';

@Injectable()
export class DhmStrategyProcessCronService {
  constructor(
    private readonly dhmStrategyProcessService: DhmStrategyProcessService,
  ) {}

  @Cron('*/8 * * * * *')
  async handleCron() {
    await this.dhmStrategyProcessService.process();
  }
}
