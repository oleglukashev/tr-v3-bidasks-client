import { Injectable } from '@nestjs/common';
import yargs from 'yargs';
import { ClustersEntityService } from './modules/entity-services/clusters-entity-service';
import config from './config/config.json';
import ccxt from 'ccxt';
import * as process from 'node:process';
import sentToBot from './utils/bot';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class AppService {
  constructor(
    @InjectQueue('bidasks') private bidasksQueue: Queue,
    private readonly clustersEntityService: ClustersEntityService,
    private readonly pairsEntityService: PairsEntityService,
  ) {}

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

    //for (const type in tradingServiceData.types) {
    const exchange = new ccxtProClass({
      enableRateLimit: true,
      apiKey: process.env.API_KEY,
      secret: process.env.API_SECRET,
      options: {
        defaultType: tradingServiceData.types.future.name, // Устанавливаем тип рынка на фьючерсный
      },
    });

    const pairsForbidasks = await this.pairsEntityService.findMany({
      where: {
        activated: true,
        isUsedToBidasks: true,
      },
    });

    await exchange.loadMarkets();

    for (const pair of pairsForbidasks) {
      this.watchTradesProcess({ exchange, pair });
    }
  }

  private async watchTradesProcess({ exchange, pair }: any) {
    const pairId = pair.id;

    while (true) {
      let trades: any[] = [];
      try {
        // Получаем данные по тикеру через WebSocket
        trades = await exchange.watchTrades(pair.symbol);

      } catch (error: any) {
        console.error('WebSocket connection error:', error.message);
        console.log('Reconnecting in 2 seconds...');
        await sentToBot(
          `bidasks microservice: ${pair.symbol} - ${error.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Задержка перед переподключением
      }

      // if cluster precision config exist
      if (pair.clusterPrecision) {
        for (const tfAsString in pair.clusterPrecision) {
          const tf = parseInt(tfAsString);
          const clusterSize = pair.clusterPrecision[tfAsString];

          for (const trade of trades) {
            await this.bidasksQueue.add('processTrade', {
              trade,
              tf,
              pairId,
              clusterSize,
            });
          }
        }
      }
    }
  }
}
