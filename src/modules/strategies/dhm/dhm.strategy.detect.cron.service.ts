import { Injectable } from '@nestjs/common';
import * as yargs from 'yargs';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma.service';
import { DhmStrategyDetectService } from './dhm.strategy.detect.service';
import { startOfHourTs } from '../../../utils/time';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { direction } from '../../../utils/kline';

@Injectable()
export class DhmStrategyDetectCronService {
  constructor(
    private readonly dhmStrategyDetectService: DhmStrategyDetectService,
    private readonly strategySessoinsEntityService: StrategySessionsEntityService,
    private readonly prismaService: PrismaService,
  ) {}

  @Cron('*/5 * * * * *')
  async handleCron() {
    const followDirection = 'down';
    const argv: any = yargs.argv;
    const startCurrentHourTs = startOfHourTs();

    const pairsLastKlines: any = await this.prismaService.$queryRaw`
      SELECT k.id, k.low, k.high
      FROM klines k
      INNER JOIN pairs p ON p.id = k.pair_id
      INNER JOIN (
          SELECT pair_id, MAX(ts) AS latest_timestamp
          FROM klines
          GROUP BY pair_id
      ) subquery
      ON k.pair_id = subquery.pair_id AND k.ts = subquery.latest_timestamp
      WHERE k.interval = 60 AND k.ts < ${startCurrentHourTs} AND k.pair_id = ${argv.pairId}::integer;
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
