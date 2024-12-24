import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { O1StrategyProcessService } from './o1.strategy.process.service';

@Injectable()
export class O1StrategyProcessCronService {
  constructor(
    private readonly o1StrategyProcessService: O1StrategyProcessService,
  ) {}

  @Cron('*/3 * * * * *')
  async handleCron() {
    await this.o1StrategyProcessService.process(true);
  }
}
