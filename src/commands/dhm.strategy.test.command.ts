import { CommandRunner, Command, Option } from 'nest-commander';
import { TickerPricesService } from '../modules/ticker-prices/ticker-prices.service';
import { DhmStrategyDetectService } from '../modules/strategies/dhm/dhm.strategy.detect.service';
import { KlinesEntityService } from '../modules/entity-services/klines-entity-service';
import { BalanceTrxsEntityService } from '../modules/entity-services/balance-trxs-entity-service';
import { DhmStrategyHistoryProcessService } from '../modules/strategies/dhm/dhm.strategy.history.process.service';
import { startOfMonthTs, startOfHourTs } from '../utils/time';
import { PairsEntityService } from '../modules/entity-services/pairs-entity-service';

// @Injectable()
@Command({ name: 'dhm-strategy-test', description: 'Get current prices' })
export class DhmStrategyTestCommand extends CommandRunner {
  constructor(
    private readonly tickerPricesService: TickerPricesService,
    private readonly pairsEntityService: PairsEntityService,
    private readonly dhmStrategyDetectService: DhmStrategyDetectService,
    private readonly dhmStrategyHistoryProcessService: DhmStrategyHistoryProcessService,
    private readonly klinesEntityService: KlinesEntityService,
    private readonly balanceTrxsEntityService: BalanceTrxsEntityService,
  ) {
    super();
  }
  @Option({ flags: '--symbol [string]' })
  parseSymbol(value: string): string {
    return value;
  }
  async run(passedParam, options) {
    // add balance 10000
    // await this.balanceTrxsEntityService.baseCreate({
    //
    // })
    const pair = await this.pairsEntityService.findFirst({
      where: { symbol: options.symbol },
      select: { id: true, startTs: true },
    });
    const klines = await this.klinesEntityService.findMany({
      where: {
        pairId: pair.id,
        interval: 60,
        ts: {
          lte: startOfMonthTs(),
        },
      },
      orderBy: {
        ts: 'asc',
      },
    });

    for (const kline of klines) {
      await this.dhmStrategyDetectService.detect(kline.id);
    }
    await this.dhmStrategyHistoryProcessService.process(false);
    console.log('Complete');
  }
}
