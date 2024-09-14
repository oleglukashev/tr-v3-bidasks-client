import { Injectable } from '@nestjs/common';
import currencyjs from 'currency.js';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { getFibRetracement } from '../../../utils/fib';
import { MexcService } from '../../trading-services/mexc/mexc.service';
import { nowTs } from '../../../utils/time';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as yargs from 'yargs';

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
    const sessions = await this.activeSessions();
    let account;
    try {
      account = await this.mexcService.accountInfo();
    } catch (e) {
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
      const assetName = session.pair.symbol
        .replace('USDT', '')
        .replace('USDC', '');
      const assetBalance = balances?.[assetName] || '0';

      console.log(usdAssetName);
      console.log(balances?.[usdAssetName]);
      console.log(this.ORDER_VALUE.toString());
      console.log(Number(balances?.[assetName]));

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

            // clear orders data
            session.data.orders.buy = {};

            // create buy 0.5
            if (Number(balances?.[usdAssetName]) >= this.ORDER_VALUE) {
              session.data.orders.buy['0.5'] = await this.buy(session, '0.5');
              console.log(`add buy 0.5`);
            }
          }
        }
      }

      // if after we have 30 klines and status if waiting or triggered then finish this sessions
      if (nowTs() - session.data.kline2.ts > this.FINISH_IN_MS) {
        await this.checkFinishByLength(session);
        console.log(`check finish`);
      }

      if (allowMakeTrxs) {
        if (this.getFib(session, '0.5') >= tickerPrice) {
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
            !session.data.orders.sell['0.5'] &&
            Number(assetBalance) &&
            Number(assetBalance) >=
              Number(session.data.orders.buy?.['0.5']?.origQty || 0)
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
            !session.data.orders.sell['0.618'] &&
            Number(assetBalance) &&
            Number(assetBalance) >=
              Number(session.data.orders.buy?.['0.618']?.origQty || 0)
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
            !session.data.orders.sell['1.618'] &&
            Number(assetBalance) &&
            Number(assetBalance) >=
              Number(session.data.orders.buy?.['1.618']?.origQty || 0)
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
            !session.data.orders.sell['2.414'] &&
            Number(assetBalance) &&
            Number(assetBalance) >=
              Number(session.data.orders.buy?.['2.414']?.origQty || 0)
          ) {
            session.data.orders.sell['2.414'] = await this.sell(
              session,
              '2.414',
              '1.618',
            );
            console.log(`add sell 2.414`);
          }
        }
      }

      await this.strategySessionsEntityService.baseUpdate(session.id, {
        status: session.status,
        data: session.data,
      });
      console.log('update');
    }
  }

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

  private async activeSessions() {
    return this.strategySessionsEntityService.findMany({
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
