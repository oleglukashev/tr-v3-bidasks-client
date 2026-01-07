import ccxt from 'ccxt';
import * as yargs from 'yargs';
import config from '../config/config.json';
import moment from 'moment';

import * as zlib from 'zlib';
import csv from 'csv-parser';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

//const MIN_INTERVAL = 60000;

import { CommandRunner, Command, Option } from 'nest-commander';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ClustersEntityService } from '../modules/entity-services/clusters-entity-service';
import { getStartTsByTf, startOfMinuteTs } from '../utils/time';
import {
  getCluster,
  getClusterKeyByPairIdTsTf,
  saveCluster,
} from '../utils/redis';

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
    pairId,
    symbol,
    tradingServiceData,
    startDate,
    endDate,
  }: any) {
    const dates = this.timePeriodsArray(startDate, endDate, 'day');
    for (const date of dates) {
      const url = `https://public.bybit.com/trading/${symbol}/${symbol}${date}.csv.gz`;
      console.log('url: ', url);
      console.log(
        `date: ${date}, trades process start:`,
        moment().format('HH:mm.ss'),
      );
      let tradesCount = 0;
      for await (const trade of this.importFromGzUrl(url)) {
        // await saveToDb(row);

        // if cluster precision config exist
        if (tradingServiceData.types.future.tickers[pairId].clusterPrecision) {
          for (const tfAsString in tradingServiceData.types.future.tickers[
            pairId
          ].clusterPrecision) {
            const tf = parseInt(tfAsString);
            const clusterSize =
              tradingServiceData.types.future.tickers[pairId].clusterPrecision[
                tfAsString
              ];
            const data: any = this.prepareTrade(trade);
            await this.processTrade(data, tf, pairId, this.redis, clusterSize);
          }
        }

        tradesCount++;
      }
      console.log(
        `date: ${date}, trades count: ${tradesCount}, trades process end:`,
        moment().format('HH:mm.ss'),
      );
      await this.moveDataFromRedisToBd(pairId, date);
    }
  }

  async processTrade(trade, tf, pairId, redis, clusterSize) {
    const startTs = getStartTsByTf(trade.timestamp, tf);
    const priceCluster = this.clustersEntityService.getPriceCluster(
      trade,
      clusterSize,
    );
    // if no startTs in clusters clear this tf clusters and create new cluster
    // if (!this.clusters[pairId][tf]?.[startTs]) {
    const clusterKey = getClusterKeyByPairIdTsTf(pairId, tf, startTs);
    let cluster: any = await getCluster(clusterKey, redis);

    if (!cluster) {
      cluster = {
        data: {},
        ts: startTs,
        pairId: parseInt(pairId),
        tf: tf,
        createdAt: new Date(),
        updatedAt: new Date(),
        v: 0,
      };

      await saveCluster(clusterKey, cluster, redis);
    }

    if (!cluster.data?.[priceCluster]) {
      cluster.data[priceCluster] =
        this.clustersEntityService.getDefaultClusterData(priceCluster);
    }

    const priceClusterData: any =
      this.clustersEntityService.updatePriceClusterData(
        cluster.data[priceCluster],
        trade,
      );

    const tradeVolume = trade.amount;
    cluster.v += parseInt(tradeVolume);
    cluster.data[priceCluster] = priceClusterData;

    try {
      // await this.clustersEntityService.baseUpdate(
      //   this.clusters[pairId][tf][startTs].id,
      //   {
      //     v: this.clusters[pairId][tf][startTs].v,
      //     data: this.clusters[pairId][tf][startTs].data,
      //   },
      // );
      await saveCluster(clusterKey, cluster, redis);
      // await this.redis.hmset(
      //   `clusters:${pairId}:${tf}:${startTs}`,
      //   JSON.stringify(cluster),
      // );
    } catch (e) {
      console.log(e);
    }
  }

  private prepareTrade(trade: any) {
    return {
      timestamp: Number(parseInt(trade.timestamp) * 1000),
      amount: trade.side === 'Buy' ? Number(trade.size) : Number(-trade.size),
      price: trade.price,
      side:
        trade.side === 'Buy' ? 'buy' : trade.side === 'Sell' ? 'sell' : 'sell',
    };
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

  private timePeriodsArray(
    startDate: Date | string,
    endDate: Date | string,
    periodType: any = 'day',
    periodSize = 1,
    format = 'YYYY-MM-DD',
  ): string[] {
    const result: string[] = [];
    const current = moment.utc(startDate);
    const end = moment.utc(endDate);

    while (current.isBefore(end, periodType)) {
      result.push(current.format(format));
      current.add(periodSize, periodType);
    }

    return result;
  }

  private async moveDataFromRedisToBd(pairId: number, date: string) {
    const minutes = this.timePeriodsArray(
      `${date} 00:00:00`,
      `${date} 23:59:59`,
      'minute',
      5,
      'YYYY-MM-DD HH:mm:ss',
    );

    for (const minute of minutes) {
      const minuteUtc = moment(minute, 'YYYY-MM-DD HH:mm:ss').utc().valueOf();

      // await this.moveClusterFromRedisToBdByTf(
      //   1,
      //   minuteUtc,
      // );

      if (minuteUtc === getStartTsByTf(minuteUtc, 5)) {
        await this.moveClusterFromRedisToBdByTf(5, minuteUtc, pairId);
      }

      if (minuteUtc === getStartTsByTf(minuteUtc, 15)) {
        await this.moveClusterFromRedisToBdByTf(15, minuteUtc, pairId);
      }

      if (minuteUtc === getStartTsByTf(minuteUtc, 30)) {
        await this.moveClusterFromRedisToBdByTf(30, minuteUtc, pairId);
      }

      if (minuteUtc === getStartTsByTf(minuteUtc, 60)) {
        await this.moveClusterFromRedisToBdByTf(60, minuteUtc, pairId);
      }

      if (minuteUtc === getStartTsByTf(minuteUtc, 240)) {
        await this.moveClusterFromRedisToBdByTf(240, minuteUtc, pairId);
      }
    }
  }

  async moveClusterFromRedisToBdByTf(
    tf: number,
    startTs: number,
    pairId: number,
  ) {
    const clusterKey = getClusterKeyByPairIdTsTf(pairId, tf, startTs);
    const redisItem: any = await getCluster(clusterKey, this.redis);

    if (redisItem) {
      const cluster = await this.clustersEntityService.findFirst({
        where: {
          ts: { equals: startTs },
          tf: { equals: tf },
          pairId: { equals: pairId },
        },
      });

      if (cluster) {
        await this.clustersEntityService.baseUpdate(cluster.id, {
          ...redisItem,
          id: undefined,
        });
      } else {
        await this.clustersEntityService.baseCreate({
          ...redisItem,
          id: undefined,
        });
      }

      await this.redis.del(clusterKey);
    }
  }
}
