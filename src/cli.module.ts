import { Module } from '@nestjs/common';
import { EntityModule } from './modules/entity-services/entities.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { GrabTradesCommand } from './commands/grab-trades.command';
import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
  imports: [
    RedisModule.forRoot(
      {
        type: 'single',
        url: 'redis://localhost:6379',
        options: { db: 5 },
      },
      'bidasksDb',
    ),
    PrismaModule,
    EntityModule,
  ],
  providers: [GrabTradesCommand],
})
export class CliModule {}
