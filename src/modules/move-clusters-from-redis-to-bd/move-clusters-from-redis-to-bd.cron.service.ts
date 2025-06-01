import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MoveClustersFromRedisToBdService } from './move-clusters-from-redis-to-bd.service';
import { getStartTsByTf, startOfMinuteTs } from '../../utils/time';

@Injectable()
export class MoveClustersFromRedisToBdCronService {
  constructor(
    private readonly moveClustersFromRedisToBdService: MoveClustersFromRedisToBdService,
  ) {}

  // @Cron('* * * * *')
  // async handleEveryMinuteCron() {
  //   const now = startOfMinuteTs();
  //   await this.moveClustersFromRedisToBdService.run(1);
  //
  //   if (now === getStartTsByTf(now, 5)) {
  //     await this.moveClustersFromRedisToBdService.run(5);
  //   }
  //
  //   if (now === getStartTsByTf(now, 15)) {
  //     await this.moveClustersFromRedisToBdService.run(15);
  //   }
  //
  //   if (now === getStartTsByTf(now, 30)) {
  //     await this.moveClustersFromRedisToBdService.run(30);
  //   }
  //
  //   if (now === getStartTsByTf(now, 60)) {
  //     await this.moveClustersFromRedisToBdService.run(60);
  //   }
  //
  //   if (now === getStartTsByTf(now, 240)) {
  //     await this.moveClustersFromRedisToBdService.run(240);
  //   }
  // }
}
