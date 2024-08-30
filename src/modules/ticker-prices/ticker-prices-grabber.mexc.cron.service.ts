import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MexcService } from '../trading-services/mexc/mexc.service';
import { TickerPricesService } from './ticker-prices.service';

@Injectable()
export class TickerPricesGrabberMexcCronService {
  constructor(
    private readonly tickersPricesService: TickerPricesService,
    private readonly mexcService: MexcService,
  ) {}

  @Cron('* * * * *')
  async handleCron() {
    // TODO: it doesnt saves it global serice
    // const tickers = await this.mexcService.tickerPrice();
    // const result = {};
    // for (const item of tickers) {
    //   result[item.symbol] = item.price;
    // }
    // this.tickersPricesService.setAll(result);
  }
}
