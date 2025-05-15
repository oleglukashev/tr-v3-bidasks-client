import { Injectable } from '@nestjs/common';
import yargs from 'yargs';
import { ClustersEntityService } from './modules/entity-services/clusters-entity-service';
import config from './config/config.json';
import ccxt from 'ccxt';
import { getStartTsByTf } from './utils/time';
import * as process from 'node:process';
import sentToBot from './utils/bot';

@Injectable()
export class AppService {
  constructor(private readonly clustersEntityService: ClustersEntityService) {}

  clusters: any = {};

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
      if (!this.clusters[pairId]) {
        this.clusters[pairId] = {};
      }
      for (const tf in tradingServiceData.types.future.tickers[pairId]
        .clusterPrecision) {
        this.clusters[pairId][tf] = {};
      }
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
        for (const tf in tradingServiceData.types.future.tickers[pairId]
          .clusterPrecision) {
          const clusterSize =
            tradingServiceData.types.future.tickers[pairId].clusterPrecision[
              tf
            ];

          for (const trade of trades) {
            const startTs = getStartTsByTf(trade.timestamp, parseInt(tf));

            let priceCluster =
              Math.ceil(parseFloat(trade.price) / clusterSize) * clusterSize;
            priceCluster = Number(
              priceCluster.toFixed(clusterSize.toString().split('.')[1].length),
            );

            // if no startTs in clusters clear this tf clusters and create new cluster
            if (!this.clusters[pairId][tf]?.[startTs]) {
              this.clusters[pairId][tf] = {};

              try {
                console.log('create cluster');
                this.clusters[pairId][tf][startTs] =
                  await this.clustersEntityService.baseCreate({
                    data: {},
                    ts: startTs,
                    pairId: parseInt(pairId),
                    tf: parseInt(tf),
                  });
              } catch (e) {
                this.clusters[pairId][tf][startTs] =
                  await this.clustersEntityService.findFirst({
                    where: {
                      ts: { equals: startTs },
                      pairId: { equals: parseInt(pairId) },
                      tf: { equals: parseInt(tf) },
                    },
                  });
                console.log(e);
              }
            }

            if (!this.clusters[pairId][tf]?.[startTs].data?.[priceCluster]) {
              this.clusters[pairId][tf][startTs].data[priceCluster] = {
                p: priceCluster.toString(),
                v: 0,
                bv: 0,
                sv: 0,
              };
            }

            const priceClusterData =
              this.clusters[pairId][tf][startTs].data[priceCluster];
            const tradeVolume = trade.amount;
            this.clusters[pairId][tf][startTs].v += parseInt(tradeVolume);
            priceClusterData.v = (
              parseFloat(priceClusterData.v) + parseFloat(tradeVolume)
            ).toString();

            if (trade.side === 'buy') {
              priceClusterData.bv = (
                parseFloat(priceClusterData.bv) + parseFloat(tradeVolume)
              ).toString();
            } else if (trade.side === 'sell') {
              priceClusterData.sv = (
                parseFloat(priceClusterData.sv) + parseFloat(tradeVolume)
              ).toString();
            }

            this.clusters[pairId][tf][startTs].data[priceCluster] =
              priceClusterData;

            try {
              console.log(`${pairId},${tf}: update cluster`);
              await this.clustersEntityService.baseUpdate(
                this.clusters[pairId][tf][startTs].id,
                {
                  v: this.clusters[pairId][tf][startTs].v,
                  data: this.clusters[pairId][tf][startTs].data,
                },
              );
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
      console.log(`added ${trades.length} ${symbol} markets bidasks`);
    }
  }
}
