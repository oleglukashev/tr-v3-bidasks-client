import { Injectable } from '@nestjs/common';
import * as Mexc from 'mexc-sdk';

@Injectable()
export class MexcService {
  apiKey = null;
  apiSecret = null;
  client = null;

  constructor() {
    this.apiKey = 'mx0vglbbLTEy54k87T';
    this.apiSecret = '7809725dc5a84b5685c4a905b2323ea5';
    this.client = new Mexc.Spot(this.apiKey, this.apiSecret);
  }

  async klines(
    symbol: string,
    startTs: number,
    endTs: number,
    interval = '1m',
    limit = 1000,
  ) {
    return this.client.klines(symbol, interval, {
      startTime: startTs,
      endTime: endTs,
      limit,
    });
  }

  async tickerPrice() {
    return this.client.tickerPrice();
  }

  async newOrder(
    symbol: string,
    side: string,
    orderType: string,
    options: any,
  ) {
    return this.client.newOrder(symbol, side, orderType, options);
  }

  async cancelOrder(symbol: string, options: any) {
    return this.client.cancelOrder(symbol, options);
  }

  async newOrderTest(
    symbol: string,
    side: string,
    orderType: string,
    options: any,
  ) {
    return this.client.newOrderTest(symbol, side, orderType, options);
  }

  async cancelOpenOrders(symbol: string) {
    return this.client.cancelOpenOrders(symbol);
  }

  async accountInfo() {
    return this.client.accountInfo();
  }
}
