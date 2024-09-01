import { Injectable } from '@nestjs/common';
import currencyjs from 'currency.js';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { getFibRetracement } from '../../../utils/fib';
import { StrategySessionTrxsEntityService } from '../../entity-services/strategy-session-trxs-entity-service';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { TickerPricesService } from '../../ticker-prices/ticker-prices.service';
import { MexcService } from '../../trading-services/mexc/mexc.service';
import { nowTs } from '../../../utils/time';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class DhmStrategyProcessService {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    private readonly strategySessionTrxsEntityService: StrategySessionTrxsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
    private readonly tickerPricesService: TickerPricesService,
    private readonly mexcService: MexcService,
    @InjectRedis('priceDb') private readonly redis: Redis,
  ) {}

  readonly FINISH_IN_MS = 3 * 24 * 60 * 60 * 1000;
  readonly ORDER_VALUE = 10;

  async process(allowMakeTrxs = true) {
    console.log('start', nowTs());
    await this.check(allowMakeTrxs);
    console.log('end', nowTs());
  }

  private async check(allowMakeTrxs = true) {
    const sessions = await this.activeSessions();
    let account;
    try {
      account = await this.mexcService.accountInfo();
    } catch(e) {
      console.log(e);
      return;
    }
    const balances = {};

    if (account?.balances?.length) {
      for (const item of account.balances) {
        balances[item.asset] = item.free;
      }
    }

    for (const session of sessions) {
      const tickerPrice = await this.redis.get(session.pair.symbol);
      const usdAssetName = session.pair.symbol.includes('USDT')
        ? 'USDT'
        : 'USDC';

      console.log(usdAssetName);
      console.log(balances?.[usdAssetName]);
      console.log(this.ORDER_VALUE.toString());

      if (!session.data?.orders) {
        session.data.orders = {
          buy: {},
          sell: {},
        };
      }

      if (allowMakeTrxs) {
        //set orders
        if (
          !session.data.orders.buy?.['0.5']?.orderId &&
          Number(balances?.[usdAssetName]) >= this.ORDER_VALUE
        ) {
          session.data.orders.buy['0.5'] = await this.buy(session, '0.5');
          console.log(`add buy 0.5`);
        }

        // if (!session.data.orders.buy?.['0.618']?.orderId && Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
        //   session.data.orders.buy['0.618'] = await this.buy(session, '0.618');
        //   console.log(`add buy 0.618`);
        // }
        //
        // if (!session.data.orders.buy?.['1.618']?.orderId && Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
        //   session.data.orders.buy['1.618'] = await this.buy(session, '1.618');
        //   console.log(`add buy 1.618`);
        // }
        //
        // if (!session.data.orders.buy?.['2.414']?.orderId && Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
        //   session.data.orders.buy['2.414'] = await this.buy(session, '2.414');
        //   console.log(`add buy 2.414`);
        // }
      }

      if (session.status === 'waiting') {
        //await this.setHigh(session, session.data.kline2, allowMakeTrxs);
        if (tickerPrice > session.data.high) {
          session.data.high = tickerPrice;
          console.log(`set new high`);

          if (allowMakeTrxs) {
            // cancel previous orders
            if (session.data.orders.buy?.['0.5']?.orderId) {
              await this.cancel(session.pair.symbol, {
                orderId: session.data.orders.buy['0.5'].orderId,
              });
              console.log(`cancel order 0.5`);
            }
            // if (session.data.orders.buy?.['0.618']?.orderId) {
            //   await this.cancel(session.pair.symbol, {
            //     orderId: session.data.orders.buy['0.618'].orderId,
            //   });
            //   console.log(`cancel order 0.618`);
            // }
            // if (session.data.orders.buy?.['1.618']?.orderId) {
            //   await this.cancel(session.pair.symbol, {
            //     orderId: session.data.orders.buy['1.618'].orderId,
            //   });
            //   console.log(`cancel order 1.618`);
            // }
            // if (session.data.orders.buy?.['2.414']?.orderId) {
            //   await this.cancel(session.pair.symbol, {
            //     orderId: session.data.orders.buy['2.414'].orderId,
            //   });
            //   console.log(`cancel order 2.414`);
            // }

            // clear orders data
            session.data.orders.buy = {};

            // create buy 0.5
            if (Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
              session.data.orders.buy['0.5'] = await this.buy(session, '0.5');
              console.log(`add buy 0.5`);
            }

            // // create buy 0.618
            // if (this.getFib(session, '0.5') >= tickerPrice && Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
            //   session.data.orders.buy['0.618'] = await this.buy(session, '0.618');
            //   console.log(`add buy 0.618`);
            // }
            //
            // // create buy 1.618
            // if (this.getFib(session, '0.618') >= tickerPrice && Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
            //   session.data.orders.buy['1.618'] = await this.buy(session, '1.618');
            //   console.log(`add buy 1.618`);
            // }
            //
            // // create buy 2.414
            // if (this.getFib(session, '1.618') >= tickerPrice && Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
            //   session.data.orders.buy['2.414'] = await this.buy(session, '2.414');
            //   console.log(`add buy 2.414`);
            // }
          }
        }
      }

      // if after we have 30 klines and status if waiting or triggered then finish this sessions
      if (nowTs() - session.data.kline2.ts > this.FINISH_IN_MS) {
        await this.checkFinishByLength(session);
        console.log(`check finish`);
      }

      if (allowMakeTrxs) {
        //if (this.session.status === 'waiting') {
        //const ts = nowTs();

        // buy
        // if (
        //   this.getFib(session, '0.382') >= tickerPrice &&
        //   !session.data.actions.buy['0.382']
        // ) {
        //   await this.addBuyAction(session, tickerPrice, '0.382', ts, '0.382');
        // }

        if (this.getFib(session, '0.5') >= tickerPrice) {
          // if (!session.data.actions.buy['0.5']) {
          //   await this.addBuyAction(session, tickerPrice, '0.5', ts, '0.5');
          //   session.status = 'triggered';
          // }
          if (
            !session.data.orders.buy?.['0.618']?.orderId &&
            Number(balances?.[usdAssetName]) >= this.ORDER_VALUE
          ) {
            session.data.orders.buy['0.618'] = await this.buy(session, '0.618');
            console.log(`add buy 0.618`);
          }
          if (session.status === 'waiting') {
            session.status = 'triggered';
          }

          // create sell for 0.5
          if (
            session.data.orders.buy?.['0.5']?.origQty &&
            !session.data.orders.sell['0.5']
          ) {
            session.data.orders.sell['0.5'] = await this.sell(
              session,
              '0.5',
              '0.382',
            );
            console.log(`add sell 0.5`);
          }
        }

        if (this.getFib(session, '0.618') >= tickerPrice) {
          if (
            !session.data.orders.buy?.['1.618']?.orderId &&
            Number(balances?.[usdAssetName]) >= this.ORDER_VALUE
          ) {
            session.data.orders.buy['1.618'] = await this.buy(session, '1.618');
            console.log(`add buy 1.618`);
          }

          if (session.status === 'waiting') {
            session.status = 'triggered';
          }

          // create sell for 0.618
          if (
            session.data.orders.buy?.['0.618']?.origQty &&
            !session.data.orders.sell['0.618']
          ) {
            session.data.orders.sell['0.618'] = await this.sell(
              session,
              '0.618',
              '0.5',
            );
            console.log(`add sell 0.618`);
          }
        }

        if (this.getFib(session, '1.618') >= tickerPrice) {
          if (
            !session.data.orders.buy?.['2.414']?.orderId &&
            Number(balances?.[usdAssetName]) >= this.ORDER_VALUE
          ) {
            session.data.orders.buy['2.414'] = await this.buy(session, '2.414');
            console.log(`add buy 2.414`);
          }

          if (session.status === 'waiting') {
            session.status = 'triggered';
          }

          // create sell for 1.618
          if (
            session.data.orders.buy?.['1.618']?.origQty &&
            !session.data.orders.sell['1.618']
          ) {
            session.data.orders.sell['1.618'] = await this.sell(
              session,
              '1.618',
              '0.618',
            );
            console.log(`add sell 1.618`);
          }
        }

        if (this.getFib(session, '2.414') >= tickerPrice) {
          if (session.status === 'waiting') {
            session.status = 'triggered';
          }

          // create sell for 2.414
          if (
            session.data.orders.buy?.['2.414']?.origQty &&
            !session.data.orders.sell['2.414']
          ) {
            session.data.orders.sell['2.414'] = await this.sell(
              session,
              '2.414',
              '1.618',
            );
            console.log(`add sell 2.414`);
          }
        }

        // sell
        if (this.getFib(session, '0.382') < tickerPrice) {
          // if (
          //   session.data.actions.buy['0.5'] &&
          //   !session.data.actions.sell['0.5']
          // ) {
          //   await this.addSellAction(session, tickerPrice, '0.382', ts, '0.5');
          // }
          // if (session.data.actions.buy['2.414'] && !session.data.actions.sell['2.414']) {
          //   await this.addSellAction(
          //     session,
          //     tickerPrice,
          //     '0.382',
          //     ts,
          //     '2.414',
          //   );
          //   console.log('add sell action ');
          // }
          // if (session.data.actions.buy['2.414'] && !session.data.actions.sell['0.618']) {
          //   await this.addSellAction(
          //     session,
          //     tickerPrice,
          //     '0.382',
          //     ts,
          //     '0.618',
          //   );
          // }
        }

        // if (this.getFib(session, '0.5') < tickerPrice) {
        //   if (!session.data.orders.sell['1.618']) {
        //     await this.addSellAction(session, tickerPrice, '0.5', ts, '1.618');
        //   }
        // }

        // if (this.getFib(session, '0.236') < tickerPrice) {
        //   if (!session.data.orders.sell['0.382']) {
        //     await this.addSellAction(
        //       session,
        //       tickerPrice,
        //       '0.236',
        //       ts,
        //       '0.382',
        //     );
        //   }
        // }
      }

      await this.strategySessionsEntityService.baseUpdate(session.id, {
        status: session.status,
        data: session.data,
      });
      console.log('update');
    }
  }

  // private async checkTrigger(session, kline) {
  //   // buy
  //   if (
  //     this.getFib(session, '0.382') >= kline.low &&
  //     moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
  //   ) {
  //     await this.addBuyAction(
  //       session,
  //       this.getFib(session, '0.382'),
  //       '0.382',
  //       Number(kline.ts),
  //       'triggered',
  //       false,
  //       'kline',
  //     );
  //   }
  //
  //   if (
  //     this.getFib(session, '0.5') >= kline.low &&
  //     moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
  //   ) {
  //     await this.addBuyAction(
  //       session,
  //       this.getFib(session, '0.5'),
  //       '0.5',
  //       Number(kline.ts),
  //       'dtriggered',
  //       false,
  //       'kline',
  //     );
  //     session.status = 'triggered';
  //   }
  //
  //   if (
  //     this.getFib(session, '0.618') >= kline.low &&
  //     moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
  //   ) {
  //     await this.addBuyAction(
  //       session,
  //       this.getFib(session, '0.618'),
  //       '0.618',
  //       Number(kline.ts),
  //       'ddtriggered',
  //       false,
  //       'kline',
  //     );
  //     session.status = 'triggered';
  //   }
  //
  //   if (
  //     this.getFib(session, '1.618') >= kline.low &&
  //     moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
  //   ) {
  //     await this.addBuyAction(
  //       session,
  //       this.getFib(session, '1.618'),
  //       '1.618',
  //       Number(kline.ts),
  //       'dddtriggered',
  //       false,
  //       'kline',
  //     );
  //     session.status = 'triggered';
  //   }
  //
  //   if (
  //     this.getFib(session, '2.414') >= kline.low &&
  //     moment(Number(kline.ts)).utc().startOf('hour').valueOf() < startOfHourTs()
  //   ) {
  //     await this.addBuyAction(
  //       session,
  //       this.getFib(session, '2.414'),
  //       '2.414',
  //       Number(kline.ts),
  //       'ddddtriggered',
  //       false,
  //       'kline',
  //     );
  //     session.status = 'triggered';
  //   }
  //
  //   // sell
  //   if (this.getFib(session, '0.382') < kline.high) {
  //     if (
  //       session.data.actions.dtriggered_buy &&
  //       Number(kline.ts) >= Number(session.data.actions.dtriggered_buy.ts)
  //     ) {
  //       await this.addSellAction(
  //         session,
  //         this.getFib(session, '0.382'),
  //         '0.382',
  //         Number(kline.ts),
  //         'dtriggered',
  //         'kline',
  //       );
  //     }
  //
  //     if (
  //       session.data.actions.ddddtriggered_buy &&
  //       Number(kline.ts) >= Number(session.data.actions.ddddtriggered_buy.ts)
  //     ) {
  //       await this.addSellAction(
  //         session,
  //         this.getFib(session, '0.382'),
  //         '0.382',
  //         Number(kline.ts),
  //         'ddddtriggered',
  //         'kline',
  //       );
  //     }
  //
  //     if (
  //       session.data.actions.ddtriggered_buy &&
  //       Number(kline.ts) >= Number(session.data.actions.ddtriggered_buy.ts)
  //     ) {
  //       await this.addSellAction(
  //         session,
  //         this.getFib(session, '0.382'),
  //         '0.382',
  //         Number(kline.ts),
  //         'ddtriggered',
  //         'kline',
  //       );
  //     }
  //   }
  //
  //   if (this.getFib(session, '0.5') < kline.high) {
  //     if (
  //       session.data.actions.dddtriggered_buy &&
  //       Number(kline.ts) >= Number(session.data.actions.dddtriggered_buy.ts)
  //     ) {
  //       await this.addSellAction(
  //         session,
  //         this.getFib(session, '0.5'),
  //         '0.5',
  //         Number(kline.ts),
  //         'dddtriggered',
  //         'kline',
  //       );
  //     }
  //   }
  //
  //   if (this.getFib(session, '0.236') < kline.high) {
  //     if (
  //       session.data.actions.triggered_buy &&
  //       Number(kline.ts) >= Number(session.data.actions.triggered_buy.ts)
  //     ) {
  //       await this.addSellAction(
  //         session,
  //         this.getFib(session, '0.236'),
  //         '0.236',
  //         Number(kline.ts),
  //         'triggered',
  //         'kline',
  //       );
  //     }
  //   }
  //
  //   return false;
  // }

  private async checkFinishByLength(session) {
    //const now = nowTs();
    console.log('get price finish');
    //const tickerPrice = await this.redis.get(session.pair.symbol);
    //await this.addSellAction(session, tickerPrice, null, now, '2.414');
    //await this.addSellAction(session, tickerPrice, null, now, '1.618');
    //await this.addSellAction(session, tickerPrice, null, now, '0.618');
    //await this.addSellAction(session, tickerPrice, null, now, '0.5');
    //await this.addSellAction(session, tickerPrice, null, now, '0.382');

    if (session.status !== 'finished') {
      session.status = 'finished';
    }
  }

  // private async addBuyAction(
  //   session: any,
  //   price: string,
  //   fibLevel: string,
  //   klineTs: number,
  //   actionKey: string,
  //   tsType = 'price',
  // ) {
  //   if (session.data.actions.buy[actionKey]) {
  //     return;
  //   }
  //
  //   const buyQuantity = currencyjs(this.ORDER_VALUE).divide(Number(price));
  //   const buyAction: any = {
  //     type: 'buy',
  //     price,
  //     quantity: buyQuantity,
  //     fibLevel,
  //     ts: klineTs,
  //     fibHigh: session.data.high,
  //     fibLow: session.data.kline1.low,
  //     fibPrice: this.getFib(session, fibLevel),
  //     tsType,
  //   };
  //
  //   session.data.actions.buy[actionKey] = buyAction;
  // }

  // private async addSellAction(
  //   session: any,
  //   price: string,
  //   fibLevel: string,
  //   klineTs: number,
  //   actionKey: string,
  //   tsType = 'price',
  // ) {
  //   if (
  //     !session.data.actions.buy[actionKey] ||
  //     session.data.actions.sell[actionKey]
  //   ) {
  //     return;
  //   }
  //
  //   const sellAction: any = {
  //     type: 'sell',
  //     price,
  //     quantity: session.data.actions.buy[actionKey].quantity,
  //     fibLevel,
  //     ts: klineTs,
  //     fibHigh: session.data.high,
  //     fibLow: session.data.kline1.low,
  //     fibPrice: this.getFib(session, fibLevel),
  //     tsType,
  //   };
  //
  //   session.data.actions.sell[actionKey] = sellAction;
  // }

  // private async otherKlines(session: any) {
  //   return this.klinesEntityService.findMany({
  //     where: {
  //       pairId: session.pairId,
  //       // interval 60m!!!
  //       interval: 60,
  //       ts: {
  //         gt: session.data.kline2.ts,
  //         lt: startOfHourTs(),
  //       },
  //     },
  //     orderBy: { ts: 'asc' },
  //     take: this.KLINES_LIMIT,
  //   });
  // }

  private async activeSessions() {
    return this.strategySessionsEntityService.findMany({
      where: { status: { in: ['waiting', 'triggered'] } },
      include: { pair: true },
    });
  }

  private async buy(session: any, level: string) {
    const symbol = session.pair.symbol;
    const price = this.getFib(session, level);
    const quantity = currencyjs(this.ORDER_VALUE, {
      precision: session.pair.precision,
    }).divide(Number(price));

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

  private async sell(session: any, buyLevel: string, sellLevel: string) {
    const symbol = session.pair.symbol;
    const quantity = session.data.orders.buy[buyLevel].origQty;
    const price = this.getFib(session, sellLevel);
    try {
      // await here because neet to catch error
      const res = await this.mexcService.newOrder(symbol, 'SELL', 'LIMIT', {
        quantity,
        price,
      });
      return res;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  private async cancel(symbol, options) {
    try {
      // await here because neet to catch error
      const res = await this.mexcService.cancelOrder(symbol, options);
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
