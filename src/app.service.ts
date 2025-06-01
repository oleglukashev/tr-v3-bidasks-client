import { Injectable } from '@nestjs/common';
import yargs from 'yargs';
import { ClustersEntityService } from './modules/entity-services/clusters-entity-service';
import config from './config/config.json';
import ccxt from 'ccxt';
import { getStartTsByTf } from './utils/time';
import * as process from 'node:process';
import sentToBot from './utils/bot';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  getCluster,
  getClusterKeyByPairIdTsTf,
  saveCluster,
} from './utils/redis';

@Injectable()
export class AppService {
  constructor(
    @InjectRedis('bidasksDb') private readonly redis: Redis,
    private readonly clustersEntityService: ClustersEntityService,
  ) {}

  //clusters: any = {};

  async init(): Promise<any> {
    await this.initTradesProcess();
  }

  private async initTradesProcess() {
    const argv: any = yargs.argv;
    const tradingServiceId: string = argv['tradingServiceId'];
    const tradingServiceData = config[tradingServiceId];
    const ccxtProClass = ccxt.pro[tradingServiceData.name];

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
      //const tickerAnswerSymbol = tradingServiceData.types[type].tickers[pairId].tickerAnswerSymbol;
      symbols.push(symbol);
      pairIdBySymbol[symbol] = pairId;
    }

    await exchange.loadMarkets();

    for (const symbol of symbols) {
      this.watchTradesProcess({ exchange, symbol, pairIdBySymbol });
    }
  }

  private async watchTradesProcess({ exchange, symbol, pairIdBySymbol }: any) {
    const argv: any = yargs.argv;
    const tradingServiceId: string = argv['tradingServiceId'];
    const tradingServiceData = config[tradingServiceId];
    const pairId = pairIdBySymbol[symbol];
    if (tradingServiceData.types.future.tickers[pairId].clusterPrecision) {
      // const clusterByPairId = await this.redis.hgetall(`clusters:${pairId}`);
      // if (!clusterByPairId) {
      //   await this.redis.hmset(`clusters:${pairId}`, {});
      //   //this.clusters[pairId] = {};
      // }
      // if (!this.clusters[pairId]) {
      //   this.clusters[pairId] = {};
      // }
      // for (const tf in tradingServiceData.types.future.tickers[pairId]
      //   .clusterPrecision) {
      //   this.clusters[pairId][tf] = {};
      // }
    }

    while (true) {
      let trades: any[] = [];
      try {
        // Получаем данные по тикеру через WebSocket
        trades = await exchange.watchTrades(symbol);
      } catch (error: any) {
        console.error('WebSocket connection error:', error.message);
        console.log('Reconnecting in 2 seconds...');
        await sentToBot(`bidasks microservice: ${symbol} - ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Задержка перед переподключением
      }

      // if cluster precision config exist
      if (tradingServiceData.types.future.tickers[pairId].clusterPrecision) {
        for (const tfAsString in tradingServiceData.types.future.tickers[pairId]
          .clusterPrecision) {
          const tf = parseInt(tfAsString);
          const clusterSize =
            tradingServiceData.types.future.tickers[pairId].clusterPrecision[
              tfAsString
            ];

          for (const trade of trades) {
            const startTs = getStartTsByTf(trade.timestamp, tf);
            const priceCluster = this.getPriceCluster(trade, clusterSize);
            // if no startTs in clusters clear this tf clusters and create new cluster
            // if (!this.clusters[pairId][tf]?.[startTs]) {
            const clusterKey = getClusterKeyByPairIdTsTf(pairId, tf, startTs);
            let cluster: any = await getCluster(clusterKey, this.redis);
            //let cluster: any = await this.redis.hgetall(clusterKey);
            if (!cluster?.id) {
              // this.clusters[pairId][tf] = {};

              try {
                // this.clusters[pairId][tf][startTs] =
                //   await this.clustersEntityService.baseCreate({
                //     data: {},
                //     ts: startTs,
                //     pairId: parseInt(pairId),
                //     tf: parseInt(tf),
                //   });
                cluster = await this.clustersEntityService.baseCreate({
                  data: {},
                  ts: startTs,
                  pairId: parseInt(pairId),
                  tf: tf,
                });
                await saveCluster(clusterKey, cluster, this.redis);
                //await this.redis.hmset(clusterKey, JSON.stringify(cluster));
              } catch (e) {
                // this.clusters[pairId][tf][startTs] =
                //   await this.clustersEntityService.findFirst({
                //     where: {
                //       ts: { equals: startTs },
                //       pairId: { equals: parseInt(pairId) },
                //       tf: { equals: parseInt(tf) },
                //     },
                //   });
                cluster = await this.clustersEntityService.findFirst({
                  where: {
                    ts: { equals: startTs },
                    pairId: { equals: parseInt(pairId) },
                    tf: { equals: tf },
                  },
                });
                await saveCluster(clusterKey, cluster, this.redis);
                //await this.redis.hmset(clusterKey, cluster);
                console.log(e);
              }
            }

            if (!cluster.data?.[priceCluster]) {
              cluster.data[priceCluster] =
                this.getDefaultClusterData(priceCluster);
            }

            const priceClusterData: any = this.updatePriceClusterData(
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
              await saveCluster(clusterKey, cluster, this.redis);
              // await this.redis.hmset(
              //   `clusters:${pairId}:${tf}:${startTs}`,
              //   JSON.stringify(cluster),
              // );
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    }
  }

  private getDefaultClusterData(priceCluster: any) {
    return {
      p: priceCluster.toString(),
      v: 0,
      bv: 0,
      sv: 0,
    };
  }

  private getPriceCluster(trade: any, clusterSize: number) {
    const priceCluster: number =
      Math.ceil(parseFloat(trade.price) / clusterSize) * clusterSize;
    const signsAfterPoint = clusterSize.toString().split('.')?.[1]?.length || 0;
    return Number(priceCluster.toFixed(signsAfterPoint));
  }

  private updatePriceClusterData(priceClusterData: any, trade: any) {
    const tradeVolume = trade.amount;
    const result: any = { ...priceClusterData };
    result.v = Number(
      (parseFloat(priceClusterData.v) + parseFloat(tradeVolume)).toFixed(2),
    ).toString();
    if (trade.side === 'buy') {
      result.bv = Number(
        (parseFloat(priceClusterData.bv) + parseFloat(tradeVolume)).toFixed(2),
      ).toString();
    } else if (trade.side === 'sell') {
      result.sv = Number(
        (parseFloat(priceClusterData.sv) + parseFloat(tradeVolume)).toFixed(2),
      ).toString();
    }
    return result;
  }
}
