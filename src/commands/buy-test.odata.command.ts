import { CommandRunner, Command } from 'nest-commander';
import { MexcService } from '../modules/trading-services/mexc/mexc.service';
import currencyjs from 'currency.js';

// @Injectable()
@Command({ name: 'buy-test', description: 'Buy test' })
export class BuyTestCommand extends CommandRunner {
  constructor(private readonly mexcService: MexcService) {
    super();
  }

  async run(passedParam) {
    const s = currencyjs(10, { precision: 6 }).divide(2517.45).toString();
    console.log(s);
    console.log('Complete');
  }
}
