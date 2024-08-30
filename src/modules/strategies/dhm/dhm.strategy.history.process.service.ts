import { Injectable } from '@nestjs/common';
import currencyjs from 'currency.js';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { getFibRetracement } from '../../../utils/fib';
import { StrategySessionTrxsEntityService } from '../../entity-services/strategy-session-trxs-entity-service';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { TickerPricesService } from '../../ticker-prices/ticker-prices.service';
import { MexcService } from '../../trading-services/mexc/mexc.service';
import { startOfHourTs } from '../../../utils/time';
import moment from 'moment';

@Injectable()
export class DhmStrategyHistoryProcessService {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    private readonly strategySessionTrxsEntityService: StrategySessionTrxsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
    private readonly tickerPricesService: TickerPricesService,
    private readonly mexcService: MexcService, //private readonly balanceTrxsEntityService: BalanceTrxsEntityService,
  ) {}

  readonly KLINES_LIMIT = 90;
  readonly ORDER_VALUE = 10;
  prices = {};
  session = null;
  fib = null;
  high = null;
  low = null;

  async process(allowMakeTrxs = true) {
    this.prices = await this.tickerPricesService.getFromServer();
    await this.check(allowMakeTrxs);
  }

  private async check(allowMakeTrxs = true) {
    const sessions = await this.activeSessions();

    for (const session of sessions) {
      if (!session.data?.actions) {
        session.data.actions = {};
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
        await this.checkFinishByLength(
          session,
          otherKlines[otherKlines.length - 1],
        );
      }

      await this.strategySessionsEntityService.baseUpdate(session.id, {
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
        'triggered',
        false,
        'kline',
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
        'dtriggered',
        false,
        'kline',
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
        'ddtriggered',
        false,
        'kline',
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
        'dddtriggered',
        false,
        'kline',
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
        'ddddtriggered',
        false,
        'kline',
      );
      session.status = 'triggered';
    }

    // sell
    if (this.getFib(session, '0.382') < kline.high) {
      if (
        session.data.actions.dtriggered_buy &&
        Number(kline.ts) >= Number(session.data.actions.dtriggered_buy.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.382'),
          '0.382',
          Number(kline.ts),
          'dtriggered',
          'kline',
        );
      }

      if (
        session.data.actions.ddddtriggered_buy &&
        Number(kline.ts) >= Number(session.data.actions.ddddtriggered_buy.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.382'),
          '0.382',
          Number(kline.ts),
          'ddddtriggered',
          'kline',
        );
      }

      if (
        session.data.actions.ddtriggered_buy &&
        Number(kline.ts) >= Number(session.data.actions.ddtriggered_buy.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.382'),
          '0.382',
          Number(kline.ts),
          'ddtriggered',
          'kline',
        );
      }
    }

    if (this.getFib(session, '0.5') < kline.high) {
      if (
        session.data.actions.dddtriggered_buy &&
        Number(kline.ts) >= Number(session.data.actions.dddtriggered_buy.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.5'),
          '0.5',
          Number(kline.ts),
          'dddtriggered',
          'kline',
        );
      }
    }

    if (this.getFib(session, '0.236') < kline.high) {
      if (
        session.data.actions.triggered_buy &&
        Number(kline.ts) >= Number(session.data.actions.triggered_buy.ts)
      ) {
        await this.addSellAction(
          session,
          this.getFib(session, '0.236'),
          '0.236',
          Number(kline.ts),
          'triggered',
          'kline',
        );
      }
    }

    return false;
  }

  private async checkFinishByLength(session, kline) {
    await this.addSellAction(
      session,
      kline.close,
      null,
      Number(kline.ts),
      'ddddtriggered',
    );
    await this.addSellAction(
      session,
      kline.close,
      null,
      Number(kline.ts),
      'dddtriggered',
    );
    await this.addSellAction(
      session,
      kline.close,
      null,
      Number(kline.ts),
      'ddtriggered',
    );
    await this.addSellAction(
      session,
      kline.close,
      null,
      Number(kline.ts),
      'dtriggered',
    );
    await this.addSellAction(
      session,
      kline.close,
      null,
      Number(kline.ts),
      'triggered',
    );

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
    createOrder = false,
    tsType = 'price',
  ) {
    if (session.data.actions[`${actionKey}_buy`]) {
      return;
    }

    const buyQuantity = currencyjs(this.ORDER_VALUE).divide(Number(price));
    const buyAction: any = {
      type: 'buy',
      price,
      quantity: buyQuantity,
      fibLevel,
      ts: klineTs,
      fibHigh: session.data.high,
      fibLow: session.data.kline1.low,
      fibPrice: this.getFib(session, fibLevel),
      tsType,
    };

    session.data.actions[`${actionKey}_buy`] = buyAction;
  }

  private async addSellAction(
    session: any,
    price: string,
    fibLevel: string,
    klineTs: number,
    actionKey: string,
    tsType = 'price',
  ) {
    if (
      !session.data.actions[`${actionKey}_buy`] ||
      session.data.actions[`${actionKey}_sell`]
    ) {
      return;
    }
    const sellAction: any = {
      type: 'sell',
      price,
      quantity: session.data.actions[`${actionKey}_buy`].quantity,
      fibLevel,
      ts: klineTs,
      fibHigh: session.data.high,
      fibLow: session.data.kline1.low,
      fibPrice: fibLevel ? this.getFib(session, fibLevel) : null,
      tsType,
    };

    session.data.actions[`${actionKey}_sell`] = sellAction;
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
    return this.strategySessionsEntityService.findMany({
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
