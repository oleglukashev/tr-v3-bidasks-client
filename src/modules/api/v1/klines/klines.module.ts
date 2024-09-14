import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { HistoryStrategySessionsEntityService } from '../../../entity-services/history-strategy-sessions-entity-service';
import { ApiKlinesController } from "./klines.controller";

@Module({
  imports: [],
  controllers: [ApiKlinesController],
  providers: [PrismaService, HistoryStrategySessionsEntityService],
})
export class ApiKlinesModule {}
