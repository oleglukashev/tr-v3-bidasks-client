import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { PrismaService } from '../../../prisma.service';
import { DhmStrategyDetectService } from './dhm.strategy.detect.service';
import moment from "moment";
import { startOfHourTs } from "../../../utils/time";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";

@Injectable()
export class DhmStrategyDetectCronService {
  constructor(
    private readonly dhmStrategyDetectService: DhmStrategyDetectService,
    private readonly klinesEntityService: KlinesEntityService,
    private readonly prismaService: PrismaService,
    @InjectRedis('sessionDb') private readonly redisSessionDb: Redis,
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
      WHERE k.interval = 60 AND k.ts < ${startCurrentHoutTs};
    `;
    // INTERVAL 60m!!!!

    for (const kline of pairsLastKlines) {
      await this.dhmStrategyDetectService.detect(kline.id);
    }
  }
}
