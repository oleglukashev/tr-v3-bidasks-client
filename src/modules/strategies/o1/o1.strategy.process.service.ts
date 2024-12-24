import { Injectable } from '@nestjs/common';
import currencyjs from 'currency.js';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { msInHour, nowTs } from '../../../utils/time';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as yargs from 'yargs';
import { bybit } from 'ccxt';
import { bodySizeByDiv, direction } from '../../../utils/kline';

@Injectable()
export class O1StrategyProcessService {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    @InjectRedis('priceDb') private readonly redis: Redis,
  ) {}

  readonly argv: any = yargs.argv;
  readonly FINISH_IN_MS = 3 * 24 * 60 * 60 * 1000;
  readonly LEVEREDGE = 3;
  readonly ORDER_SIZE = 10;
  readonly ORDER_VALUE = this.ORDER_SIZE * this.LEVEREDGE;

  async process(allowMakeTrxs = true) {
    console.log('start ', nowTs());
    await this.check(allowMakeTrxs);
    console.log('end', nowTs());
  }

  private async check(allowMakeTrxs = true) {
    const session = await this.activeSession();
    if (!session) {
      return;
    }

    // for (const session of sessions) {
    const tickerPrice = await this.redis.get(
      `${this.argv.tradingServiceId}:${this.argv.pairId}:${this.argv.type}`,
    );
    const balance = await this.redis.get(
      `${this.argv.tradingServiceId}:balance:USDT`,
    );
    console.log(`current price of ${session.pair.symbol}: ${tickerPrice}`);
    console.log(`current balance USDT: ${balance}`);

    this.tryInitSessionData(session);

    if (session.status === 'waiting') {
      if (allowMakeTrxs) {
        await this.tryBuyFeature(session, balance);
      }
      session.status = 'triggered';
      console.log(`set triggered`);
    }

    const halfKlineBodyPrice =
      direction(session.data.kline) === 'up'
        ? parseFloat(session.data.kline.close) -
          bodySizeByDiv(2, session.data.kline)
        : parseFloat(session.data.kline.close) +
          bodySizeByDiv(2, session.data.kline);

    // if first hour after start session current price less thatn half of kline body then SL
    const isTheNextHourAfterInitKline =
      nowTs() - session.data.kline.ts > msInHour &&
      nowTs() - session.data.kline.ts < msInHour * 2;

    if (direction(session.data.kline) === 'up') {
      if (isTheNextHourAfterInitKline) {
        if (parseFloat(tickerPrice) < halfKlineBodyPrice) {
          // remove order if order is exist
          session.status = 'cancelled';
          console.log(`set cancelled`);
        }
      } else {
        // check and move SL to 1.618
      }
    } else {
      if (isTheNextHourAfterInitKline) {
        if (parseFloat(tickerPrice) > halfKlineBodyPrice) {
          // remove order if order is exist
          session.status = 'cancelled';
          console.log(`set cancelled`);
        }
      } else {
        // check and move SL to 1.618
      }
    }

    // if after we have 30 klines and status if waiting or triggered then finish this sessions
    if (
      nowTs() - session.data.kline.ts > this.FINISH_IN_MS &&
      session.status === 'triggered'
    ) {
      session.status = 'finished_by_length';
      console.log(`set finish by length`);
    }

    await this.strategySessionsEntityService.baseUpdate(session.id, {
      status: session.status,
      data: session.data,
    });
    console.log('update');
  }

  private async activeSession() {
    return this.strategySessionsEntityService.findFirst({
      where: {
        type: { equals: 'o1' },
        status: { in: ['waiting', 'triggered'] },
        pairId: { equals: parseInt(this.argv.pairId) },
      },
      include: { pair: true },
    });
  }

  private async tryBuyFeature(session: any, balance: string) {
    const price =
      direction(session.data.kline) === 'up'
        ? parseFloat(session.data.kline.high)
        : parseFloat(session.data.kline.low);
    const tpPrice =
      direction(session.data.kline) === 'up'
        ? price + bodySizeByDiv(3, session.data.kline)
        : price - bodySizeByDiv(3, session.data.kline);
    const slPricePrice =
      direction(session.data.kline) === 'up'
        ? price - bodySizeByDiv(2, session.data.kline)
        : price + bodySizeByDiv(2, session.data.kline);

    // if current ticker price bellow buy level and order still isn't exist
    if (
      ['waiting', 'triggered'].includes(session.status) &&
      !session.data.orders.buy?.id &&
      parseFloat(balance) > this.ORDER_SIZE
    ) {
      session.data.orders.buy = await this.buyFeature(
        session,
        price.toString(),
        tpPrice.toString(),
        slPricePrice.toString(),
      );
    }
  }

  private async buyFeature(
    session: any,
    price: string,
    tpPrice: string,
    slPricePrice: string,
  ) {
    const symbol = session.pair.symbol.replace('USDT', '/USDT:USDT');
    const quantity = currencyjs(this.ORDER_VALUE, {
      precision: session.pair.precision,
    }).divide(Number(price)).value;

    try {
      // await here because neet to catch error
      const exchange = new bybit({
        apiKey: 'OPjbJFSBIP48EDZ6GU',
        secret: 'XYcAvOJcrWZc99Z9LthHu9txnjLVKxOAkaiQ',
        options: {
          defaultType: 'future', // Указываем, что будем работать с фьючерсами
        },
      });

      await exchange.setMarginMode('isolated', symbol, {
        leverage: this.LEVEREDGE,
      });

      // Дополнительные параметры, специфичные для Bybit
      const params = {
        stop_loss: slPricePrice,
        take_profit: tpPrice,
        post_only: true,
        // tp_trigger_by: 'LastPrice', // Опционально, тип цены для срабатывания TP
        // sl_trigger_by: 'LastPrice', // Опционально, тип цены для срабатывания SL
        // time_in_force: 'GoodTillCancel', // Время действия ордера
      };

      const order = await exchange.createOrder(
        symbol,
        'limit',
        'buy',
        quantity,
        parseFloat(price),
        params,
      );
      console.log('Ордер с TP/SL успешно создан:', order);
      return order;
    } catch (e) {
      console.log(e);
      console.log('error');
      return null;
    }
  }

  private async tryCancelByLevel(session: any) {
    if (session.data.orders.buy?.id) {
      await this.cancel(session.pair.symbol, {
        id: session.data.orders.buy.id,
      });
      console.log(`cancel order`);
    }
  }

  private async cancel(symbol, options) {
    symbol = symbol.replace('USDT', '/USDT:USDT');
    try {
      // await here because neet to catch error
      const exchange = new bybit({
        apiKey: 'OPjbJFSBIP48EDZ6GU',
        secret: 'XYcAvOJcrWZc99Z9LthHu9txnjLVKxOAkaiQ',
        options: {
          defaultType: 'future', // Указываем, что будем работать с фьючерсами
        },
      });
      const res = await exchange.cancelOrder(options.id, symbol);
      return res;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  private tryInitSessionData(session: any) {
    if (!session.data?.orders) {
      session.data.orders = {
        buy: {},
      };
    }
  }
}
