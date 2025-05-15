import { Module } from '@nestjs/common';
import { EntityModule } from './modules/entity-services/entities.module';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule, EntityModule],
  providers: [
    // Commands
  ],
})
export class CliModule {}
