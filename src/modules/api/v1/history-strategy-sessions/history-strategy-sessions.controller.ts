import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { HistoryStrategySessionsEntityService } from '../../../entity-services/history-strategy-sessions-entity-service';

@ApiTags('HistoryStrategySessions')
@Controller({ path: 'api/v1' })
export class ApiHistoryStrategySessionsController {
  constructor(
    private readonly historyStrategySessionsEntityService: HistoryStrategySessionsEntityService,
  ) {}

  @Get('/pairs/:pairId/history_strategy_sessions')
  @ApiOkResponse({
    description: 'List of history strategy sessions',
  })
  public async index(
    @Param('pairId', new DefaultValuePipe(0), ParseIntPipe) pairId,
  ): Promise<any> {
    return this.historyStrategySessionsEntityService.findMany({
      where: { pairId },
    });
  }
}
