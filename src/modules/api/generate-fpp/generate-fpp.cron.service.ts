import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import moment from 'moment';
import yargs from 'yargs';
import config from '../../../config/config.json';
import { GenerateFppService } from './generate-fpp.service';

@Injectable()
export class GenerateFppCronService {
  constructor(private readonly generateFppService: GenerateFppService) {}

  @Cron('* * * * *')
  async handleEveryMinuteCron() {
    const argv: any = yargs.argv;
    const tradingServiceId: string = argv['tradingServiceId'];
    const tradingServiceData = config[tradingServiceId];
    console.log(moment().format('YYYY-MM-DD HH:mm:ss'));
    for (const pairId in tradingServiceData.types.future.tickers) {
      await this.generateFppService.processFpp(parseInt(pairId), 1);
    }
  }

  @Cron('*/5 * * * *')
  async handleEvery5MinutesCron() {
    const argv: any = yargs.argv;
    const tradingServiceId: string = argv['tradingServiceId'];
    const tradingServiceData = config[tradingServiceId];
    console.log(moment().format('YYYY-MM-DD HH:mm:ss'));
    for (const pairId in tradingServiceData.types.future.tickers) {
      await this.generateFppService.processFpp(parseInt(pairId), 5);
    }
  }
}
