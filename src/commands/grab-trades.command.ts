import ccxt from 'ccxt';
import * as yargs from 'yargs';
import config from '../config/config.json';
import { PrismaClient } from '@prisma/client';
import moment from 'moment';

import { Injectable } from '@nestjs/common';
import * as zlib from 'zlib';
import csv from 'csv-parser';
import { pipeline } from 'stream/promises';
import { request } from 'https';
import { Readable } from 'stream';

//const MIN_INTERVAL = 60000;

import { CommandRunner, Command, Option } from 'nest-commander';
import * as process from 'node:process';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ClustersEntityService } from '../modules/entity-services/clusters-entity-service';

const intervalByTf: any = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

// @Injectable()
@Command({
  name: 'grab-trades',
  options: { isDefault: true },
  description: 'Grab trades',
})
export class GrabTradesCommand extends CommandRunner {
  constructor(
    @InjectRedis('bidasksDb') private readonly redis: Redis,
    private readonly clustersEntityService: ClustersEntityService,
  ) {
    super();
  }

  @Option({ flags: '--symbol [string]' })
  parseSymbol(value: string): string {
    return value;
  }

  @Option({ flags: '--startDate [string]' })
  parseStartTs(value: string): string {
    return value;
  }

  @Option({ flags: '--endDate [string]' })
  parseEndTs(value: string): string {
    return value;
  }

  async run(passedParams, options) {
    const argv: any = yargs.argv;
    //const tradingServiceId: string = argv['tradingServiceId'];
    const tradingServiceId = '2';
    //const selectedTf: string = argv['tf'];
    const tradingServiceData = config[tradingServiceId];
    const ccxtProClass = ccxt[tradingServiceData.name];
    if (!ccxtProClass) {
      throw new Error(`No exchnage ${argv.exchange} in ccxt pro`);
    }

    const pairIdBySymbol: any = {};
    //for (const type in tradingServiceData.types) {
    const exchange = new ccxtProClass({
      enableRateLimit: true,
      apiKey: process.env.API_KEY,
      secret: process.env.API_SECRET,
      options: {
        defaultType: tradingServiceData.types.future.name, // Устанавливаем тип рынка на фьючерсный
      },
    });

    const symbols = [];

    for (const pairId in tradingServiceData.types.future.tickers) {
      const symbol = tradingServiceData.types.future.tickers[pairId].symbol;
      //const tickerAnswerSymbol = tradingServiceData.types.future.tickers[pairId].tickerAnswerSymbol;
      symbols.push(symbol);
      pairIdBySymbol[symbol] = pairId;
    }

    for (const symbol of symbols) {
      if (symbol !== options.symbol) {
        continue;
      }
      // for (const tf of tradingServiceData.timeframes) {
      //   if (tf === '1m') {
      //     continue;
      //   }
      //   await this.grablinesProcess({
      //     exchange,
      //     pairId: parseInt(pairIdBySymbol[symbol]),
      //     symbol,
      //     tf,
      //     startTs: options.startTs,
      //     endTs: options.endTs,
      //   });
      // }
      await this.fetchAndSave({
        exchange,
        pairId: parseInt(pairIdBySymbol[symbol]),
        symbol,
        tradingServiceData,
        startDate: options.startDate,
        endDate: options.endDate,
      });
    }

    console.log('Complete');
  }

  async fetchAndSave({
    exchange,
    pairId,
    symbol,
    tradingServiceData,
    startDate,
    endDate,
  }: any) {
    for await (const trade of this.importFromGzUrl(
      'https://public.bybit.com/trading/KASUSDT/KASUSDT2025-01-01.csv.gz',
    )) {
      console.log(trade);
      // await saveToDb(row);

      // if cluster precision config exist
      if (tradingServiceData.types.future.tickers[pairId].clusterPrecision) {
        for (const tfAsString in tradingServiceData.types.future.tickers[pairId]
          .clusterPrecision) {
          const tf = parseInt(tfAsString);
          const clusterSize =
            tradingServiceData.types.future.tickers[pairId].clusterPrecision[
              tfAsString
            ];

          const data: any = {
            timestamp: Number(parseInt(trade.timestamp) * 1000),
            amount:
              trade.side === 'Buy' ? Number(trade.size) : Number(-trade.size),
            price: trade.price,
            side:
              trade.side === 'Buy'
                ? 'buy'
                : trade.side === 'Sell'
                ? 'sell'
                : 'sell',
          };

          console.log(data);

          await this.clustersEntityService.processTrade(
            data,
            tf,
            pairId,
            this.redis,
            clusterSize,
          );
        }
      }
    }
  }

  private async *importFromGzUrl(url: string): AsyncGenerator<any> {
    const response = await fetch(url);

    if (!response.ok || !response.body) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    // fetch → Node stream
    const source = Readable.fromWeb(response.body as any);

    const gunzip = zlib.createGunzip();
    const parser = csv();

    const rows: any[] = [];
    parser.on('data', (row) => rows.push(row));

    // pipeline запускаем асинхронно
    const pipePromise = pipeline(source, gunzip, parser);

    // отдаём строки по мере поступления
    while (true) {
      if (rows.length > 0) {
        yield rows.shift();
      } else {
        // если pipeline завершён и данных больше нет — выходим
        if (parser.readableEnded) break;
        await new Promise((r) => setImmediate(r));
      }
    }

    await pipePromise;
  }
}
