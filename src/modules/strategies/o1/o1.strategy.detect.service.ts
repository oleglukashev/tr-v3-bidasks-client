import { Injectable } from '@nestjs/common';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { direction } from '../../../utils/kline';

@Injectable()
export class O1StrategyDetectService {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
  ) {}

  async detect(klineId, test = false) {
    const kline = await this.klinesEntityService.findFirst({
      where: { id: { equals: klineId } },
    });

    // up klines
    if (direction(kline) === 'up') {
      const wickSum =
        parseFloat(kline.high) -
        parseFloat(kline.close) +
        (parseFloat(kline.open) - parseFloat(kline.low));
      const klineBodySum = parseFloat(kline.close) - parseFloat(kline.open);

      if (wickSum / klineBodySum > 0.65) {
        await this.createStrategySession(kline);
      }
    }
  }

  async createStrategySession(kline) {
    const existStrategySession =
      await this.strategySessionsEntityService.findFirst({
        where: {
          AND: [
            {
              type: { equals: 'o1' },
            },
            {
              pairId: { equals: kline.pairId },
            },
            {
              data: {
                path: ['klineId'],
                equals: kline.id,
              },
            },
          ],
        },
      });

    if (!existStrategySession) {
      await this.strategySessionsEntityService.baseCreate({
        pairId: kline.pairId,
        startTs: kline.ts,
        type: 'o1',
        data: {
          klineId: kline.id,
          kline: kline,
          low: kline.low,
          high: kline.high,
        },
      });
    }
  }
}
