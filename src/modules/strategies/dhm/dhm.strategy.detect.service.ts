import { Injectable } from '@nestjs/common';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { getFibRetracement } from '../../../utils/fib';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { direction } from '../../../utils/kline';

@Injectable()
export class DhmStrategyDetectService {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
  ) {}

  async detect(klineId, followDirection = null) {
    const kline2 = await this.klinesEntityService.findFirst({
      where: { id: klineId },
    });
    const kline1 = await this.klinesEntityService.findFirst({
      where: {
        pairId: kline2.pairId,
        ts: kline2.ts - BigInt(3600000),
        interval: 60,
      },
    });

    // exit if prev kline eq curre kline
    if (!kline1 || !kline2 || kline2?.ts === kline1.ts) {
      console.log('no klines or 1 nad 2 are the same');
      return;
    }

    if (
      followDirection &&
      (direction(kline1) !== followDirection ||
        direction(kline2) !== followDirection)
    ) {
      console.log('one of kline has wrong direction');
      return;
    }

    await this.searchSecondKline(kline1, kline2);
  }

  async searchSecondKline(kline1, kline2) {
    const directionValue = direction(kline1);
    if (directionValue === 'up') {
      // direction - up
      if (kline2.high <= kline1.high) {
        return;
      }
      const fib = getFibRetracement({
        levels: { 0: kline1.high, 1: kline1.low },
      });

      if (fib['0.5'] > kline2.low) {
        return;
      }
    } else {
      // direction - down
      if (kline2.low >= kline1.low) {
        return;
      }
      const fib = getFibRetracement({
        levels: { 0: kline1.low, 1: kline1.high },
      });

      if (fib['0.5'] < kline2.high) {
        return;
      }
    }

    // if (kline2.high <= kline1.high) {
    //   return;
    // }

    // const fib = getFibRetracement({
    //   levels: { 0: kline1.high, 1: kline1.low },
    // });

    // if (fib['0.5'] > kline2.low) {
    //   return;
    // }

    const existStrategySession =
      await this.strategySessionsEntityService.findFirst({
        where: {
          AND: [
            {
              type: { equals: 'dhm' },
              direction: directionValue,
              pairId: { equals: kline2.pairId },
            },
            {
              data: {
                path: ['kline1Id'],
                equals: kline1.id,
              },
            },
            {
              data: {
                path: ['kline2Id'],
                equals: kline2.id,
              },
            },
          ],
        },
      });

    if (!existStrategySession) {
      await this.strategySessionsEntityService.baseCreate({
        pairId: kline1.pairId,
        startTs: kline1.ts,
        type: 'dhm',
        direction: directionValue,
        data: {
          kline1Id: kline1.id,
          kline2Id: kline2.id,
          kline1: kline1,
          kline2: kline2,
          low: directionValue === 'up' ? kline1.low : kline2.low,
          high: directionValue === 'up' ? kline2.high : kline1.high,
        },
      });
    }
  }
}
