import { Injectable } from '@nestjs/common';
import * as yargs from 'yargs';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma.service';
import { O1StrategyDetectService } from './o1.strategy.detect.service';
import { startOfHourTs } from '../../../utils/time';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';

@Injectable()
export class O1StrategyDetectCronService {
  constructor(
    private readonly dhmStrategyDetectService: O1StrategyDetectService,
    private readonly strategySessoinsEntityService: StrategySessionsEntityService,
    private readonly prismaService: PrismaService,
  ) {}

  @Cron('*/5 * * * * *')
  async handleCron() {
    const argv: any = yargs.argv;
    const startCurrentHoutTs = startOfHourTs();
    const existTriggeredStrategySession =
      await this.strategySessoinsEntityService.findFirst({
        where: {
          status: { in: ['waiting', 'triggered'] },
          pairId: parseInt(argv.pairId),
        },
      });

    if (existTriggeredStrategySession) {
      console.log(
        `Triggered strategy sessions with pair id ${argv.pairId} already exist`,
      );
      return;
    }

    const pairsLastKlines: any = await this.prismaService.$queryRaw`
      SELECT k.id
      FROM klines k
      INNER JOIN pairs p ON p.id = k.pair_id
      INNER JOIN (
          SELECT pair_id, MAX(ts) AS latest_timestamp
          FROM klines
          GROUP BY pair_id
      ) subquery
      ON k.pair_id = subquery.pair_id AND k.ts = subquery.latest_timestamp
      WHERE k.interval = 60 AND k.ts < ${startCurrentHoutTs} AND k.pair_id = ${argv.pairId}::integer;
    `;
    // INTERVAL 60m!!!!

    for (const kline of pairsLastKlines) {
      await this.dhmStrategyDetectService.detect(kline.id);
    }
  }
}
