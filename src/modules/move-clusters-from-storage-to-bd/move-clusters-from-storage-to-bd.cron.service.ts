import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getStartTsByTf, startOfMinuteTs } from '../../utils/time';
import { ClustersEntityService } from '../entity-services/clusters-entity-service';

@Injectable()
export class MoveClustersFromStorageToBdCronService {
  constructor(
    private readonly clustersEntityService: ClustersEntityService,
  ) {}

  @Cron('* * * * *')
  async handleEveryMinuteCron() {
    const now = startOfMinuteTs();
    await this.clustersEntityService.moveClusterFromRedisToBdByTf(1);

    if (now === getStartTsByTf(now, 5)) {
      await this.clustersEntityService.moveClusterFromRedisToBdByTf(5);
    }

    if (now === getStartTsByTf(now, 15)) {
      await this.clustersEntityService.moveClusterFromRedisToBdByTf(15);
    }

    if (now === getStartTsByTf(now, 30)) {
      await this.clustersEntityService.moveClusterFromRedisToBdByTf(30);
    }

    if (now === getStartTsByTf(now, 60)) {
      await this.clustersEntityService.moveClusterFromRedisToBdByTf(60);
    }

    if (now === getStartTsByTf(now, 240)) {
      await this.clustersEntityService.moveClusterFromRedisToBdByTf(240);
    }
  }
}
