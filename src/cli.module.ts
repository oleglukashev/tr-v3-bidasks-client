import { Module } from '@nestjs/common';
import { BuyTestCommand } from './commands/buy-test.odata.command';

@Module({
  imports: [],
  providers: [
    // Commands
    BuyTestCommand,
  ],
})
export class CliModule {}
