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
    //if (tradingServiceData.types.future.tickers[pairId].clusterPrecision) {
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
    //}

    while (true) {
      let trades: any[] = [];
      try {
        // Получаем данные по тикеру через WebSocket
        trades = await exchange.watchTrades(symbol);
        this.bidasksProcess(tradingServiceData, pairId, trades);
      } catch (error: any) {
        console.error('WebSocket connection error:', error.message);
        console.log('Reconnecting in 2 seconds...');
        await sentToBot(`bidasks microservice: ${symbol} - ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Задержка перед переподключением
      }
    }
  }

  private async bidasksProcess(tradingServiceData, pairId, trades) {
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
          await this.clustersEntityService.processTrade(
            trade,
            tf,
            pairId,
            this.redis,
            clusterSize,
          );
        }
      }
    }
  }
}
