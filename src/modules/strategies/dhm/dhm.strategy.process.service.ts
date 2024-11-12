import { Injectable } from '@nestjs/common';
import currencyjs from 'currency.js';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { getFibRetracement } from '../../../utils/fib';
import { MexcService } from '../../trading-services/mexc/mexc.service';
import { nowTs } from '../../../utils/time';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as yargs from 'yargs';
import { bybit } from 'ccxt';

@Injectable()
export class DhmStrategyProcessService {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    private readonly mexcService: MexcService,
    @InjectRedis('priceDb') private readonly redis: Redis,
  ) {}

  readonly argv: any = yargs.argv;
  readonly FINISH_IN_MS = 3 * 24 * 60 * 60 * 1000;
  readonly ORDER_VALUE = 10;

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
    const tickerPrice = await this.redis.get(session.pair.symbol);
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
        await this.recreateOrders(session);
      }
    }

    // check status as 'waiting' and update it to triggered when price is under 0.5
    if (
      this.getFib(session, '0.5') >= tickerPrice &&
      session.status === 'waiting'
    ) {
      session.status = 'triggered';
      console.log(`set triggered`);
    }

    // if (allowMakeTrxs) {
    //   //set orders
    //   if (
    //     !session.data.orders.buy?.['0.5']?.orderId &&
    //     Number(balances?.[usdAssetName]) >= this.ORDER_VALUE
    //   ) {
    //     session.data.orders.buy['0.5'] = await this.buy(session, '0.5');
    //     console.log(`add buy 0.5`);
    //   }
    // }

    // if after we have 30 klines and status if waiting or triggered then finish this sessions
    if (
      nowTs() - session.data.kline2.ts > this.FINISH_IN_MS &&
      (session.status === 'waiting' || session.status === 'triggered')
    ) {
      session.status = 'finished_by_length';
      console.log(`set finish by length`);
    }

    console.log(session.data);

    if (allowMakeTrxs && session.status === 'triggered') {
      if (this.getFib(session, '0.382') >= tickerPrice) {
        if (
          !session.data.orders.buy?.['0.5']?.id
          //Number(balances?.[usdAssetName]) >= this.ORDER_VALUE
        ) {
          console.log(`start add buy feature 0.5`);
          session.data.orders.buy['0.5'] = await this.buyFeature(
            session,
            '0.5',
            '0.382',
            '1.618',
          );
          console.log(`add buy feature 0.5`);
        }

        // create sell for 0.5
        // if (
        //   session.data.orders.buy?.['0.5']?.origQty &&
        //   !session.data.orders.sell['0.5'] &&
        //   Number(assetBalance) &&
        //   Number(assetBalance) >=
        //     Number(session.data.orders.buy?.['0.5']?.origQty || 0)
        // ) {
        //   session.data.orders.sell['0.5'] = await this.sell(
        //     session,
        //     '0.5',
        //     '0.382',
        //   );
        //   console.log(`add sell 0.5`);
        // }
      }

      if (this.getFib(session, '0.5') >= tickerPrice) {
        if (
          !session.data.orders.buy?.['0.618']?.id
          //Number(balances?.[usdAssetName]) >= this.ORDER_VALUE
        ) {
          console.log(`start add buy feature 0.618`);
          session.data.orders.buy['0.618'] = await this.buyFeature(
            session,
            '0.618',
            '0.5',
            '1.618',
          );
          console.log(`add buy feature 0.618`);
        }

        // create sell for 0.618
        // if (
        //   session.data.orders.buy?.['0.618']?.origQty &&
        //   !session.data.orders.sell['0.618'] &&
        //   Number(assetBalance) &&
        //   Number(assetBalance) >=
        //     Number(session.data.orders.buy?.['0.618']?.origQty || 0)
        // ) {
        //   session.data.orders.sell['0.618'] = await this.sell(
        //     session,
        //     '0.618',
        //     '0.5',
        //   );
        //   console.log(`add sell 0.618`);
        // }
      }

      if (this.getFib(session, '1.618') >= tickerPrice) {
        // check stop loss
      }
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
        status: { in: ['waiting', 'triggered'] },
        pairId: parseInt(this.argv.PAIR_ID),
      },
      include: { pair: true },
    });
  }

  private async buy(session: any, level: string) {
    const symbol = session.pair.symbol;
    const price = this.getFib(session, level);
    const quantity = currencyjs(this.ORDER_VALUE, {
      precision: session.pair.precision,
    })
      .divide(Number(price))
      .toString();

    try {
      // await here because neet to catch error
      const res = await this.mexcService.newOrder(symbol, 'BUY', 'LIMIT', {
        quantity,
        price,
      });
      return res;
      // {
      //   symbol: 'KASUSDT',
      //   orderId: 'C02__452751805076508672094',
      //   orderListId: -1,
      //   price: '0.16',
      //   origQty: '10',
      //   type: 'LIMIT',
      //   side: 'BUY',
      //   transactTime: 1723726677918
      // }
    } catch (e) {
      console.log(e);
      return null;
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

      // Дополнительные параметры, специфичные для Bybit
      const params = {
        stop_loss: this.getFib(session, stopLevel),
        take_profit: this.getFib(session, profitLevel),
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

  private async recreateOrders(session: any) {
    console.log('recreate');
    if (session.data.orders.buy?.['0.5']?.id) {
      await this.cancel(session.pair.symbol, {
        id: session.data.orders.buy['0.5'].id,
      });
      console.log(`cancel order 0.5`);
    }

    if (session.data.orders.buy?.['0.618']?.id) {
      await this.cancel(session.pair.symbol, {
        id: session.data.orders.buy['0.618'].id,
      });
      console.log(`cancel order 0.618`);
    }

    // clear orders data
    session.data.orders.buy = {};

    // create buy 0.5
    //if (Number(balances) >= this.ORDER_VALUE) {
    session.data.orders.buy['0.5'] = await this.buy(session, '0.5');
    console.log(`add buy 0.5`);
    //}

    //if (Number(balances) >= this.ORDER_VALUE) {
    session.data.orders.buy['0.618'] = await this.buy(session, '0.618');
    console.log(`add buy 0.618`);
    //}
  }

  // private async cancel(symbol, options) {
  //   try {
  //     // await here because neet to catch error
  //     const res = await this.mexcService.cancelOrder(symbol, options);
  //     return res;
  //   } catch (e) {
  //     console.log(e);
  //     return null;
  //   }
  // }
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
        1: session.data.kline1.low,
      },
    })[key].toString();
  }
}
