import { Module } from '@nestjs/common';
import { EntityModule } from './modules/entity-services/entities.module';
import { GenerateFppCommand } from './commands/generate-fpp.command';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule, EntityModule],
  providers: [
    // Commands
    GenerateFppCommand,
  ],
})
export class CliModule {}
