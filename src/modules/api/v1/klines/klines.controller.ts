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
import { KlinesEntityService } from '../../../entity-services/klines-entity-service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller({ path: 'api/v1/klines' })
export class ApiKlinesController {
  constructor(private readonly klinesEntityService: KlinesEntityService) {}

  @Get('')
  @ApiOkResponse({ description: 'List of klines' })
  @HttpCode(HttpStatus.OK)
  public async byIds(
    @Query('pairId', new DefaultValuePipe(false), ParseIntPipe) pairId,
    @Query('tf', new DefaultValuePipe(false), ParseIntPipe) tf,
    @Query('page', new DefaultValuePipe(false), ParseIntPipe) page,
    @Query('limit', new DefaultValuePipe(false), ParseIntPipe) limit,
  ): Promise<any> {
    let items = await this.klinesEntityService.findMany({
      where: {
        pairId,
        interval: tf,
      },
      orderBy: { ts: 'desc' },
      page,
      take: limit,
    });
    items = items.reverse();
    return items;
  }
}
