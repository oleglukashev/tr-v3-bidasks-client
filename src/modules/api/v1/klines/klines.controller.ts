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
  @ApiOkResponse({ description: 'List of products by id' })
  @HttpCode(HttpStatus.OK)
  public async byIds(
    @Query('pairId', new DefaultValuePipe(false), ParseIntPipe) pairId,
    @Query('page', new DefaultValuePipe(false), ParseIntPipe) page,
    @Query('limit', new DefaultValuePipe(false), ParseIntPipe) limit,
  ): Promise<any> {
    return this.klinesEntityService.findMany({
      where: {
        pairId,
      },
      orderBy: { ts: 'desc' },
      page,
      take: limit,
    });
  }
}
