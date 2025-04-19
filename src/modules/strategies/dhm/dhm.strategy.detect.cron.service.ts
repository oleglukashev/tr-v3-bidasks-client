import { Injectable } from '@nestjs/common';
import * as yargs from 'yargs';
import { Cron } from '@nestjs/schedule';
import { KlinesPrismaService } from '../../klinesPrisma/klinesPrisma.service';
import { DhmStrategyDetectService } from './dhm.strategy.detect.service';
import { startOfHourAgoTs, startOfHourTs } from '../../../utils/time';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { direction } from '../../../utils/kline';

@Injectable()
export class DhmStrategyDetectCronService {
  constructor(
    private readonly dhmStrategyDetectService: DhmStrategyDetectService,
    private readonly strategySessoinsEntityService: StrategySessionsEntityService,
    private readonly klinesPrismaService: KlinesPrismaService,
  ) {}

  @Cron('*/5 * * * * *')
  async handleCron() {
    //const followDirection = 'down';
    const followDirection = null;
    const argv: any = yargs.argv;
    const startCurrentHourTs = startOfHourAgoTs();

    const pairsLastKlines: any = await this.klinesPrismaService.$queryRaw`
      SELECT k.id, k.low, k.high, k.ts
      FROM klines k
      INNER JOIN pairs p ON p.id = k.pair_id
      WHERE k.interval = 60 AND k.ts = ${startCurrentHourTs} AND k.pair_id = ${argv.pairId}::integer LIMIT 1;
    `;
    // INTERVAL 60m!!!!

    for (const kline of pairsLastKlines) {
      const directionValue = direction(kline);
      const existTriggeredStrategySessionWithDirection =
        await this.strategySessoinsEntityService.findFirst({
          where: {
            status: { in: ['waiting', 'triggered'] },
            pairId: { equals: parseInt(argv.pairId) },
            direction: { equals: directionValue },
          },
        });

      if (existTriggeredStrategySessionWithDirection) {
        console.log(
          `Triggered strategy sessions with pair id ${argv.pairId} and direction ${directionValue} already exist`,
        );
        continue;
      }

      await this.dhmStrategyDetectService.detect(kline.id, followDirection);
    }
  }
}
