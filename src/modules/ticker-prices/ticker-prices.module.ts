import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MexcModule } from '../trading-services/mexc/mexc.module';
import { MexcService } from '../trading-services/mexc/mexc.service';
import { TickerPricesService } from './ticker-prices.service';
import { TickerPricesGrabberMexcCronService } from './ticker-prices-grabber.mexc.cron.service';

@Module({
  imports: [MexcModule],
  providers: [
    PrismaService,
    MexcService,
    TickerPricesService,
    TickerPricesGrabberMexcCronService,
  ],
})
export class TickerPricesModule {}
