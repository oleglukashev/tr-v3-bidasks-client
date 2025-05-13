import { Injectable } from '@nestjs/common';
import yargs from 'yargs';
import { KlinesEntityService } from './modules/entity-services/klines-entity-service';
import http from 'http';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import config from './config/config.json';
import ccxt from 'ccxt';
import sentToBot from './utils/bot';

@Injectable()
export class AppService {
  constructor(private readonly klinesEntityService: KlinesEntityService) {}

  readonly intervalByTf: any = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
  };

  server = http.createServer();
  wss = new WebSocket.Server({ server: this.server });
  wsSubscriptions = new Map();
  pairIdBySymbol: any = {};

  async init(): Promise<any> {
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

    const symbols = [];

    for (const pairId in tradingServiceData.types.future.tickers) {
      const symbol = tradingServiceData.types.future.tickers[pairId].symbol;
      const tickerAnswerSymbol =
        tradingServiceData.types.future.tickers[pairId].tickerAnswerSymbol;
      symbols.push(symbol);
      this.pairIdBySymbol[tickerAnswerSymbol] = pairId;
    }

    await exchange.loadMarkets();
    const subscriptions = [];
    for (const symbol of symbols) {
      for (const tf of tradingServiceData.timeframes) {
        subscriptions.push([symbol, tf]);
      }
    }
    this.initWsManager();
    this.server.listen(process.env.WS_PORT, () => {
      console.log(
        `WebSocket сервер работает на http://localhost:${process.env.WS_PORT}`,
      );
    });
    await this.watchKlinesProcess({ exchange, subscriptions });
    // }
  }

  private initWsManager() {
    // Обработка нового подключения
    this.wss.on('connection', (ws: any) => {
      const connectionId = uuidv4();
      ws.id = connectionId;
      console.log('Клиент подключен');

      ws.on('message', async (msg: any) => {
        try {
          const data = JSON.parse(msg);
          if (data.type === 'subscribe' && data.pairId && data.tf) {
            this.wsSubscriptions.set(ws.id, {
              ws,
              tf: data.tf,
              pairId: data.pairId,
            });
            console.log(`Подписка клиента: ${data.pairId} @ ${data.tf}`);
          }
        } catch (e) {
          console.error('Ошибка обработки сообщения:', e);
        }
      });

      ws.on('close', () => {
        this.wsSubscriptions.delete(ws.id);
        console.log('Клиент отключён');
      });
    });
  }

  async watchKlinesProcess({ exchange, subscriptions }: any) {
    while (true) {
      try {
        // Получаем данные по тикеру через WebSocket
        const klines = await exchange.watchOHLCVForSymbols(subscriptions);
        console.log(klines);
        for (const key in klines) {
          let pairId = null;
          if (this.pairIdBySymbol[key]) {
            pairId = parseInt(this.pairIdBySymbol[key]);
          } else {
            continue;
          }
          for (const tf in klines[key]) {
            for (const kline of klines[key][tf]) {
              let dbKline = null;

              try {
                dbKline = await this.klinesEntityService.baseCreate({
                  ts: kline[0],
                  open: kline[1].toString(),
                  high: kline[2].toString(),
                  low: kline[3].toString(),
                  close: kline[4].toString(),
                  volume: kline[5].toString(),
                  pairId,
                  interval: this.intervalByTf[tf],
                });
              } catch (e: any) {
                if (e.code == 'P2002') {
                  const existKline = await this.klinesEntityService.findFirst({
                    where: {
                      ts: kline[0],
                      pairId,
                      interval: this.intervalByTf[tf],
                    },
                  });
                  if (existKline) {
                    dbKline = await this.klinesEntityService.baseUpdate(
                      existKline.id,
                      {
                        open: kline[1].toString(),
                        high: kline[2].toString(),
                        low: kline[3].toString(),
                        close: kline[4].toString(),
                        volume: kline[5].toString(),
                      },
                    );
                  }
                } else {
                  console.log(e);
                }
              }

              if (dbKline) {
                const arr: any[] = Array.from(this.wsSubscriptions.values());
                for (const wsData of arr) {
                  if (
                    wsData.ws.readyState === WebSocket.OPEN &&
                    wsData.tf === this.intervalByTf[tf] &&
                    wsData.pairId === pairId
                  ) {
                    wsData.ws.send(
                      JSON.stringify({
                        type: 'kline',
                        data: { ...dbKline, ts: dbKline.ts.toString() },
                      }),
                    );
                  }
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.error('WebSocket connection error:', error.message);
        console.log('Reconnecting in 3 seconds...');
        await sentToBot(error.message);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
}
