import { CommandRunner, Command } from 'nest-commander';
import { bybit } from 'ccxt';

// @Injectable()
@Command({ name: 'buy-test', description: 'Buy test' })
export class BuyTestCommand extends CommandRunner {
  constructor() {
    super();
  }

  async run() {
    console.log(11);
    const a = await this.buyFeature();
    console.log(a);
    console.log('Complete');
  }

  private async buyFeature() {
    const symbol = 'KAS/USDT:USDT';
    const price = 0.155;
    const quantity = 160;

    try {
      console.log(1);
      // await here because neet to catch error
      const exchange = new bybit({
        apiKey: 'OPjbJFSBIP48EDZ6GU',
        secret: 'XYcAvOJcrWZc99Z9LthHu9txnjLVKxOAkaiQ',
        options: {
          defaultType: 'future', // Указываем, что будем работать с фьючерсами
        },
      });
      console.log(2);

      await exchange.setMarginMode('isolated', symbol, { leverage: 10 });

      // Дополнительные параметры, специфичные для Bybit
      const params = {
        stop_loss: '0.145',
        take_profit: '0.16',
        // tp_trigger_by: 'LastPrice', // Опционально, тип цены для срабатывания TP
        // sl_trigger_by: 'LastPrice', // Опционально, тип цены для срабатывания SL
        // time_in_force: 'GoodTillCancel', // Время действия ордера
      };
      console.log(3);

      const order = await exchange.createOrder(
        symbol,
        'limit',
        'buy',
        quantity,
        price,
        params,
      );
      console.log(4);
      console.log('Ордер с TP/SL успешно создан:', order);
      return order;
    } catch (e) {
      console.log(e);
      console.log('error');
      return null;
    }
  }
}
