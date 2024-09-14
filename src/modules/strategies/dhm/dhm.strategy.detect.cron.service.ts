import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma.service';
import { DhmStrategyDetectService } from './dhm.strategy.detect.service';
import { startOfHourTs } from '../../../utils/time';

@Injectable()
export class DhmStrategyDetectCronService {
  constructor(
    private readonly dhmStrategyDetectService: DhmStrategyDetectService,
    private readonly prismaService: PrismaService,
  ) {}

  @Cron('*/10 * * * * *')
  async handleCron() {
    const startCurrentHoutTs = startOfHourTs();
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
      WHERE k.interval = 60 AND k.ts < ${startCurrentHoutTs} AND k.pair_id = ${process.env.PAIR_ID}::integer;
    `;
    // INTERVAL 60m!!!!

    for (const kline of pairsLastKlines) {
      await this.dhmStrategyDetectService.detect(kline.id);
    }
  }
}
