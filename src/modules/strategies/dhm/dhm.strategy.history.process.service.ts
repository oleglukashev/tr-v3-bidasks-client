import { Injectable } from '@nestjs/common';
import currencyjs from 'currency.js';
import { getFibRetracement } from '../../../utils/fib';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { startOfHourTs } from '../../../utils/time';
import moment from 'moment';
import { HistoryStrategySessionsEntityService } from '../../entity-services/history-strategy-sessions-entity-service';

@Injectable()
export class DhmStrategyHistoryProcessService {
  constructor(
    private readonly historyStrategySessionsEntityService: HistoryStrategySessionsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
  ) {}

  readonly KLINES_LIMIT = 90;
  readonly ORDER_VALUE = 10;
  fib = null;
  high = null;
  low = null;

  async process() {
    await this.check();
  }

  private async check() {
    const sessions = await this.activeSessions();

    for (const session of sessions) {
      if (!session.data?.actions) {
        session.data.actions = {
          buy: {},
          sell: {},
        };
      }

      if (session.status === 'waiting') {
        await this.setHigh(session, session.data.kline2);
      }

      const otherKlines = await this.otherKlines(session);
      for (const kline of otherKlines) {
        // update high
        if (session.status === 'waiting') {
          await this.setHigh(session, kline);
        }
        await this.checkTrigger(session, kline);
      }

      // if after we have 30 klines and status if waiting or triggered then finish this sessions
      if (otherKlines.length >= this.KLINES_LIMIT) {
        await this.checkFinishByLength(session);
      }

      await this.historyStrategySessionsEntityService.baseUpdate(session.id, {
        status: session.status,
        data: session.data,
      });
    }
  }

  private async checkTrigger(session, kline) {
    // buy
    if (
      this.getFib(session, '0.382') >= kline.low &&
      moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
    ) {
      await this.addBuyAction(
        session,
        this.getFib(session, '0.382'),
        '0.382',
        Number(kline.ts),
        '0.382',
      );
    }

    if (
      this.getFib(session, '0.5') >= kline.low &&
      moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
    ) {
      await this.addBuyAction(
        session,
        this.getFib(session, '0.5'),
        '0.5',
        Number(kline.ts),
        '0.5',
      );
      session.status = 'triggered';
    }

    if (
      this.getFib(session, '0.618') >= kline.low &&
      moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
    ) {
      await this.addBuyAction(
        session,
        this.getFib(session, '0.618'),
        '0.618',
        Number(kline.ts),
        '0.618',
      );
      session.status = 'triggered';
    }

    if (
      this.getFib(session, '1.618') >= kline.low &&
      moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
    ) {
      await this.addBuyAction(
        session,
        this.getFib(session, '1.618'),
        '1.618',
        Number(kline.ts),
        '1.618',
      );
      session.status = 'triggered';
    }

    if (
      this.getFib(session, '2.414') >= kline.low &&
      moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
    ) {
      await this.addBuyAction(
        session,
        this.getFib(session, '2.414'),
        '2.414',
        Number(kline.ts),
        '2.414',
      );
      session.status = 'triggered';
      if (session.data.kline1.id === '5562764f-cfcb-4c4d-80f3-5428b3983de0') {
        console.log(kline.ts);
        console.log(session.data.actions.buy['2.414']);
      }
    }

    // sell
    if (this.getFib(session, '0.382') < kline.high) {
      if (
        session.data.actions.buy['0.5'] &&
        Number(kline.ts) >= Number(session.data.actions.buy?.['0.5']?.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.382'),
          '0.382',
          Number(kline.ts),
          '0.5',
        );
      }

      if (session.data.kline1.id === '5562764f-cfcb-4c4d-80f3-5428b3983de0') {
        console.log(kline.ts);
        console.log(session.data.actions.sell['2.414']);
        console.log(kline.high);
        console.log(this.getFib(session, '0.382'));
        console.log(Number(kline.ts));
        console.log(session.data.actions.buy['2.414']);
      }

      if (
        session.data.actions.buy['2.414'] &&
        Number(kline.ts) >= Number(session.data.actions.buy?.['2.414']?.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.382'),
          '0.382',
          Number(kline.ts),
          '2.414',
        );
      }

      if (
        session.data.actions.buy['0.618'] &&
        Number(kline.ts) >= Number(session.data.actions.buy?.['0.618']?.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.382'),
          '0.382',
          Number(kline.ts),
          '0.618',
        );
      }
    }

    if (this.getFib(session, '0.5') < kline.high) {
      if (
        session.data.actions.buy['1.618'] &&
        Number(kline.ts) >= Number(session.data.actions.buy?.['1.618']?.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.5'),
          '0.5',
          Number(kline.ts),
          '1.618',
        );
      }
    }

    if (this.getFib(session, '0.236') < kline.high) {
      if (
        session.data.actions.buy['0.382'] &&
        Number(kline.ts) >= Number(session.data.actions.buy?.['0.382']?.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.236'),
          '0.236',
          Number(kline.ts),
          '0.382',
        );
      }
    }

    return false;
  }

  private async checkFinishByLength(session) {
    if (session.status !== 'finished') {
      session.status = 'finished';
    }
  }

  private async addBuyAction(
    session: any,
    price: string,
    fibLevel: string,
    klineTs: number,
    actionKey: string,
  ) {
    if (session.data.actions.buy[actionKey]) {
      return;
    }

    const buyQuantity = currencyjs(this.ORDER_VALUE).divide(Number(price)).toString();
    const buyAction: any = {
      type: 'buy',
      price,
      quantity: buyQuantity,
      fibLevel,
      ts: klineTs,
      fibHigh: session.data.high,
      fibLow: session.data.kline1.low,
      fibPrice: this.getFib(session, fibLevel),
    };

    session.data.actions.buy[actionKey] = buyAction;
  }

  private async addSellAction(
    session: any,
    price: string,
    fibLevel: string,
    klineTs: number,
    actionKey: string,
  ) {
    if (
      !session.data.actions.buy[actionKey] ||
      session.data.actions.sell[actionKey]
    ) {
      return;
    }
    const sellAction: any = {
      type: 'sell',
      price,
      quantity: session.data.actions.buy[actionKey].quantity,
      fibLevel,
      ts: klineTs,
      fibHigh: session.data.high,
      fibLow: session.data.kline1.low,
      fibPrice: fibLevel ? this.getFib(session, fibLevel) : null,
    };

    session.data.actions.sell[actionKey] = sellAction;
  }

  private async setHigh(session, kline) {
    if (!session.data.high || kline.high > session.data.high) {
      session.data.high = kline.high;
      session.data.highKline = kline;
    }
  }

  private async otherKlines(session: any) {
    return this.klinesEntityService.findMany({
      where: {
        pairId: session.pairId,
        // interval 60m!!!
        interval: 60,
        ts: {
          gt: session.data.kline2.ts,
          lt: startOfHourTs(),
        },
      },
      orderBy: { ts: 'asc' },
      take: this.KLINES_LIMIT,
    });
  }

  private async activeSessions() {
    return this.historyStrategySessionsEntityService.findMany({
      where: { status: { in: ['waiting', 'triggered'] } },
      include: { pair: true },
    });
  }

  private getFib(session, key: string) {
    return getFibRetracement({
      levels: {
        0: session.data.high,
        1: session.data.kline1.low,
      },
    })[key].toString();
  }
}
