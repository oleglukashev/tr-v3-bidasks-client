import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { HistoryStrategySessionsEntityService } from '../../../entity-services/history-strategy-sessions-entity-service';
import { ApiHistoryStrategySessionsController } from './history-strategy-sessions.controller';

@Module({
  imports: [],
  controllers: [ApiHistoryStrategySessionsController],
  providers: [PrismaService, HistoryStrategySessionsEntityService],
})
export class ApiHistoryStrategySessionsModule {}
