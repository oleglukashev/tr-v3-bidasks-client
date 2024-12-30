import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { O1StrategyDetectCronService } from './o1.strategy.detect.cron.service';
import { StrategySessionsEntityService } from '../../entity-services/strategy-sessions-entity-service';
import { KlinesEntityService } from '../../entity-services/klines-entity-service';
import { O1StrategyProcessCronService } from './o1.strategy.process.cron.service';
import { O1StrategyDetectService } from './o1.strategy.detect.service';
import { O1StrategyProcessService } from './o1.strategy.process.service';
import { OrdersEntityService } from '../../entity-services/orders-entity-service';

@Module({
  imports: [],
  providers: [
    PrismaService,
    KlinesEntityService,
    OrdersEntityService,
    StrategySessionsEntityService,
    O1StrategyDetectCronService,
    O1StrategyProcessCronService,
    O1StrategyDetectService,
    O1StrategyProcessService,
  ],
})
export class O1StrategyModule {}
