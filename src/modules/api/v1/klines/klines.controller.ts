import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  HttpStatus,
  Query,
  DefaultValuePipe,
  Get,
  HttpCode,
  ParseIntPipe,
  NotFoundException,
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

  @Get('by_pair_id_and_tf_and_ts')
  @ApiOkResponse({ description: 'Get kline by pair_id, tf and ts' })
  @HttpCode(HttpStatus.OK)
  public async byPairIdAndTfAndTs(
    @Query('pairId', new DefaultValuePipe(false), ParseIntPipe) pairId,
    @Query('tf', new DefaultValuePipe(false), ParseIntPipe) tf,
    @Query('ts', new DefaultValuePipe(false), ParseIntPipe) ts,
  ): Promise<any> {
    const kline = await this.klinesEntityService.findFirst({
      where: {
        pairId,
        interval: tf,
        ts,
      },
    });

    if (!kline) {
      throw new NotFoundException('Kline not found');
    }

    return kline;
  }
}
