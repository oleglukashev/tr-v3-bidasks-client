import { Injectable } from '@nestjs/common';
import currencyjs from 'currency.js';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { getFibRetracement } from '../../../utils/fib';
import { nowTs } from '../../../utils/time';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as yargs from 'yargs';
import { bybit } from 'ccxt';

@Injectable()
export class DhmStrategyProcessService {
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
    console.log('start', nowTs());
    await this.check(allowMakeTrxs);
    console.log('end', nowTs());
  }

  private async check(allowMakeTrxs = true) {
    const session = await this.activeSession();
    if (!session) {
      return;
    }
    // let account;
    // try {
    //   account = await this.mexcService.accountInfo();
    // } catch (e) {
    //   console.log(e);
    //   return;
    // }
    // const balances = {};
    //
    // if (account?.balances?.length) {
    //   for (const item of account.balances) {
    //     balances[item.asset] = item.free;
    //   }
    // }

    // for (const session of sessions) {
    const tickerPrice = await this.redis.get(
      `${this.argv.tradingServiceId}:${this.argv.pairId}:${this.argv.type}`,
    );
    const balance = await this.redis.get(
      `${this.argv.tradingServiceId}:balance:USDT`,
    );
    console.log(`current price of ${session.pair.symbol}: ${tickerPrice}`);
    console.log(`current balance USDT: ${balance}`);
    // const usdAssetName = session.pair.symbol.includes('USDT')
    //   ? 'USDT'
    //   : 'USDC';
    // const assetName = session.pair.symbol
    //   .replace('USDT', '')
    //   .replace('USDC', '');
    //const assetBalance = balances?.[assetName] || '0';

    if (!session.data?.orders) {
      session.data.orders = {
        buy: {},
        sell: {},
      };
    }

    // update high and recreate orders if status is waiting and price is higher
    if (session.status === 'waiting' && tickerPrice > session.data.high) {
      session.data.high = tickerPrice;
      console.log(`set new high`);

      if (allowMakeTrxs) {
        // recreate previous orders
        await this.recreateOrders(session, tickerPrice, balance);
      }
    }

    if (
      this.getFib(session, '0.49') >= tickerPrice &&
      session.status === 'waiting'
    ) {
      session.status = 'triggered';
      console.log(`set triggered`);
    }

    // if after we have 30 klines and status if waiting or triggered then finish this sessions
    if (
      nowTs() - session.data.kline2.ts > this.FINISH_IN_MS &&
      (session.status === 'waiting' || session.status === 'triggered')
    ) {
      session.status = 'finished_by_length';
      console.log(`set finish by length`);
    }

    if (allowMakeTrxs) {
      if (session.status === 'triggered') {
        if (this.getFib(session, '0.382') <= tickerPrice) {
          // if price didn't come to 0.618 and up to 0.382 we close feature of 0.618
          await this.tryCancelByLevel(session, '0.608');
          // if price up to 0.382 we finish the session
          session.status = 'finished';
          console.log(`set finished`);
        }

        if (this.getFib(session, '1.618') >= tickerPrice) {
          // check stop loss
        }
      }

      // create buy 0.5
      await this.tryBuyFeature(
        tickerPrice,
        '0.236',
        session,
        '0.49',
        '0.382',
        '2.414',
        balance,
      );

      // create buy 0.618
      await this.tryBuyFeature(
        tickerPrice,
        '0.382',
        session,
        '0.608',
        '0.5',
        '2.414',
        balance,
      );
    }

    await this.strategySessionsEntityService.baseUpdate(session.id, {
      status: session.status,
      data: session.data,
    });
    console.log('update');
    // }
  }

  private async activeSession() {
    return this.strategySessionsEntityService.findFirst({
      where: {
        type: { equals: 'dhm' },
        status: { in: ['waiting', 'triggered'] },
        pairId: parseInt(this.argv.pairId),
      },
      include: { pair: true },
    });
  }

  // private async buy(session: any, level: string) {
  //   const symbol = session.pair.symbol;
  //   const price = this.getFib(session, level);
  //   const quantity = currencyjs(this.ORDER_VALUE, {
  //     precision: session.pair.precision,
  //   })
  //     .divide(Number(price))
  //     .toString();
  //
  //   try {
  //     // await here because neet to catch error
  //     const res = await this.mexcService.newOrder(symbol, 'BUY', 'LIMIT', {
  //       quantity,
  //       price,
  //     });
  //     return res;
  //     // {
  //     //   symbol: 'KASUSDT',
  //     //   orderId: 'C02__452751805076508672094',
  //     //   orderListId: -1,
  //     //   price: '0.16',
  //     //   origQty: '10',
  //     //   type: 'LIMIT',
  //     //   side: 'BUY',
  //     //   transactTime: 1723726677918
  //     // }
  //   } catch (e) {
  //     console.log(e);
  //     return null;
  //   }
  // }

  private async tryBuyFeature(
    tickerPrice: any,
    buyLevel: string,
    session: any,
    level: string,
    profitLevel: string,
    stopLevel: string,
    balance: string,
  ) {
    // if current ticker price bellow buy level and order still isn't exist
    if (
      this.getFib(session, buyLevel) >= tickerPrice &&
      ['waiting', 'triggered'].includes(session.status) &&
      !session.data.orders.buy?.[level]?.id &&
      parseFloat(balance) > this.ORDER_SIZE
    ) {
      session.data.orders.buy[level] = await this.buyFeature(
        session,
        level,
        profitLevel,
        stopLevel,
      );
    }
  }

  private async buyFeature(
    session: any,
    level: string,
    profitLevel: string,
    stopLevel: string,
  ) {
    const symbol = session.pair.symbol.replace('USDT', '/USDT:USDT');
    const price = this.getFib(session, level);
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
        stop_loss: this.getFib(session, stopLevel),
        take_profit: this.getFib(session, profitLevel),
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
        price,
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

  // private async sell(session: any, buyLevel: string, sellLevel: string) {
  //   const symbol = session.pair.symbol;
  //   const quantity = session.data.orders.buy[buyLevel].origQty;
  //   const price = this.getFib(session, sellLevel);
  //   try {
  //     // await here because neet to catch error
  //     const res = await this.mexcService.newOrder(symbol, 'SELL', 'LIMIT', {
  //       quantity,
  //       price,
  //     });
  //     return res;
  //   } catch (e) {
  //     console.log(e);
  //     return null;
  //   }
  // }

  private async tryCancelByLevel(session, level) {
    if (session.data.orders.buy?.[level]?.id) {
      await this.cancel(session.pair.symbol, {
        id: session.data.orders.buy[level].id,
      });
      console.log(`cancel order ${level}`);
    }
  }

  private async recreateOrders(session: any, tickerPrice: any, balance: any) {
    console.log('recreate');
    await this.tryCancelByLevel(session, '0.49');
    await this.tryCancelByLevel(session, '0.608');

    // clear orders data
    session.data.orders.buy = {};

    // create buy 0.5
    await this.tryBuyFeature(
      tickerPrice,
      '0.236',
      session,
      '0.49',
      '0.382',
      '2.414',
      balance,
    );

    // create buy 0.618
    await this.tryBuyFeature(
      tickerPrice,
      '0.382',
      session,
      '0.608',
      '0.5',
      '2.414',
      balance,
    );
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

  private getFib(session, key: string) {
    return getFibRetracement({
      levels: {
        0: session.data.high,
        1: session.data.low,
      },
    })[key].toString();
  }
}
