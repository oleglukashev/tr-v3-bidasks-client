import { Injectable } from '@nestjs/common';
import yargs from 'yargs';
import config from './config/config.json';
import ccxt from 'ccxt';
import * as process from 'node:process';
import sentToBot from './utils/bot';
import { PairsEntityService } from './modules/entity-services/pairs-entity-service';
import { BidasksStorageService } from './modules/bidasks-storage/bidasks-storage.service';
import sleep from './utils/sleep';
import { WebsocketStreamService } from './modules/websocket-gateway/websocket-stream.service';

@Injectable()
export class AppService {
  constructor(
    private readonly pairsEntityService: PairsEntityService,
    private readonly bidasksStorageService: BidasksStorageService,
    private readonly websocketStreamService: WebsocketStreamService,
  ) {}

  async init(): Promise<any> {
    await this.initTradesProcess();
    this.bidasksStream();
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
        console.log(`got trades ${trades.length}`);
      } catch (error: any) {
        console.error('WebSocket connection error:', error.message);
        console.log('Reconnecting in 1 second...');
        await sentToBot(
          `bidasks microservice: ${pair.symbol} - ${error.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Задержка перед переподключением
      }

      // if cluster precision config exist
      if (pair.clusterPrecision) {
        for (const tfAsString in pair.clusterPrecision) {
          const tf = parseInt(tfAsString);
          // TODO: save 5 minutes only
          if (tf !== 5) {
            continue;
          }

          const clusterSize = pair.clusterPrecision[tfAsString];

          for (const trade of trades) {
            this.bidasksStorageService.processTrade(
              trade,
              tf,
              pairId,
              clusterSize,
            );
          }
        }
      }
    }
  }

  private async bidasksStream() {
    while (true) {
      const bidasks: any[] = this.bidasksStorageService.entries();
      this.websocketStreamService.emitBidasks(bidasks);
      await sleep(5000);
    }
  }
}
