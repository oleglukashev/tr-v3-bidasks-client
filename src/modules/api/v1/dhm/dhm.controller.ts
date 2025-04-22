import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  HttpStatus,
  Query,
  DefaultValuePipe,
  Get,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { StrategySessionsEntityService } from '../../../entity-services/strategy-sessions-entity-service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller({ path: 'api/v1/dhm' })
export class ApiDhmController {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
  ) {}

  @Get('')
  @ApiOkResponse({ description: 'List of dhm' })
  @HttpCode(HttpStatus.OK)
  public async byIds(
    @Query('pairId', new DefaultValuePipe(false), ParseIntPipe) pairId,
    @Query('tf', new DefaultValuePipe(false), ParseIntPipe) tf,
    @Query('page', new DefaultValuePipe(false), ParseIntPipe) page,
    @Query('limit', new DefaultValuePipe(false), ParseIntPipe) limit,
  ): Promise<any> {
    let items = await this.strategySessionsEntityService.findMany({
      where: {
        pairId,
        //interval: t,
      },
      orderBy: { startTs: 'desc' },
      page,
      take: limit,
    });
    items = items.reverse();
    return items;
  }
}
