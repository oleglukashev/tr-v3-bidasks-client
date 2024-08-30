import { Injectable } from '@nestjs/common';
import { MexcService } from '../trading-services/mexc/mexc.service';

@Injectable()
export class TickerPricesService {
  constructor(private readonly mexcService: MexcService) {}

  tickers = {};

  get(symbol: string) {
    return this.tickers[symbol];
  }

  getAll() {
    return this.tickers;
  }

  set(symbol: string, value: string) {
    this.tickers[symbol] = value;
    return this.tickers[symbol];
  }

  setAll(tickers: any) {
    this.tickers = tickers;
  }

  async getFromServer() {
    const tickers = await this.mexcService.tickerPrice();
    const result = {};
    for (const item of tickers) {
      result[item.symbol] = item.price;
    }
    return result;
  }
}
