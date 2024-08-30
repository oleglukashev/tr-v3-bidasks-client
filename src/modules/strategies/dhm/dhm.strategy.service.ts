import { Injectable } from '@nestjs/common';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { getFibRetracement } from 'src/utils/fib';
import { StrategySessionTrxsEntityService } from "../../entity-services/strategy-session-trxs-entity-service";
import { KlinesEntityService } from "../../entity-services/klines-entity-service";
import { TickerPricesService } from "../../ticker-prices/ticker-prices.service";

@Injectable()
export class DhmStrategyService {
  currentTs = null;
  started = false;

  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    private readonly strategySessionTrxsEntityService: StrategySessionTrxsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
    private readonly tickerPricesService: TickerPricesService,
  ) {
    this.started = true;
  }


}
