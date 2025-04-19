import { Injectable } from '@nestjs/common';
import * as yargs from 'yargs';
import { Cron } from '@nestjs/schedule';
import { DhmStrategyDetectService } from './dhm.strategy.detect.service';
import { startOfHourAgoTs } from '../../../utils/time';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { direction } from '../../../utils/kline';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';

@Injectable()
export class DhmStrategyDetectCronService {
  constructor(
    private readonly dhmStrategyDetectService: DhmStrategyDetectService,
    private readonly strategySessoinsEntityService: StrategySessionsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
  ) {}

  @Cron('*/5 * * * * *')
  async handleCron() {
    //const followDirection = 'down';
    const followDirection = null;
    const argv: any = yargs.argv;
    const startCurrentHourTs = startOfHourAgoTs();

    const lastKline: any = await this.klinesEntityService.findFirst({
      where: {
        interval: 60,
        ts: startCurrentHourTs,
        pairId: parseInt(argv.pairId),
      },
    });

    if (!lastKline) {
      console.log(`No last kline`);
      return;
    }

    // const pairsLastKlines: any = await this.klinesPrismaService.$queryRaw`
    //   SELECT k.id, k.low, k.high, k.ts, k.pair_id
    //   FROM klines k
    //   WHERE k.interval = 60 AND k.ts = ${startCurrentHourTs} AND k.pair_id = ${argv.pairId}::integer LIMIT 1;
    // `;
    // INTERVAL 60m!!!!

    //for (const kline of pairsLastKlines) {
    const directionValue = direction(lastKline);
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
      return;
    }

    await this.dhmStrategyDetectService.detect(lastKline.id, followDirection);
    //}
  }
}
