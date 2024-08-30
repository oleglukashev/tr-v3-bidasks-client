import { CommandRunner, Command, Option } from 'nest-commander';
import { TickerPricesService } from '../modules/ticker-prices/ticker-prices.service';
import { MexcService } from '../modules/trading-services/mexc/mexc.service';
import { KlinesEntityService } from '../modules/entity-services/klines-entity-service';
import { PairsEntityService } from '../modules/entity-services/pairs-entity-service';

// @Injectable()
@Command({ name: 'prices-grabber-1h', description: 'Get current prices 1h' })
export class PricesGrabber1hCommand extends CommandRunner {
  constructor(
    private readonly tickerPricesService: TickerPricesService,
    private readonly pairsEntityService: PairsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
    private readonly mexcService: MexcService,
  ) {
    super();
  }

  readonly DIFF_BETWEEN_START_AND_END = 3600000000;

  @Option({ flags: '--symbol [string]' })
  parseSymbol(value: string): string {
    return value;
  }

  async run(passedParams, options) {
    // 1h
    const pair = await this.pairsEntityService.findFirst({
      where: { symbol: options.symbol },
      select: { id: true, startTs: true },
    });
    let startTs = pair.startTs;
    let klines = [];

    do {
      try {
        klines = await this.mexcService.klines(
          options.symbol,
          startTs,
          startTs + BigInt(this.DIFF_BETWEEN_START_AND_END),
          '60m',
        );
      } catch (e) {
        console.log(e);
      }

      for (const item of klines) {
        try {
          await this.klinesEntityService.baseCreate({
            ts: item[0],
            open: item[1],
            high: item[2],
            low: item[3],
            close: item[4],
            volume: item[5],
            pairId: pair.id,
            interval: 60,
          });
        } catch (e) {
          console.log(e);
        }
      }
      startTs += BigInt(this.DIFF_BETWEEN_START_AND_END);
    } while (klines.length);
    console.log('Complete');
  }
}
