import { Module } from '@nestjs/common';
import { EntityModule } from './modules/entity-services/entities.module';
import { GenerateFppCommand } from './commands/generate-fpp.command';

@Module({
  imports: [EntityModule],
  providers: [
    // Commands
    GenerateFppCommand,
  ],
})
export class CliModule {}
