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
import { ClustersEntityService } from '../../../entity-services/clusters-entity-service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller({ path: 'api/v1/clusters' })
export class ApiClustersController {
  constructor(private readonly clustersEntityService: ClustersEntityService) {}

  @Get('')
  @ApiOkResponse({ description: 'List of clusters' })
  @HttpCode(HttpStatus.OK)
  public async byIds(
    @Query('pairId', new DefaultValuePipe(false), ParseIntPipe) pairId,
    @Query('tf', new DefaultValuePipe(false), ParseIntPipe) tf,
    @Query('page', new DefaultValuePipe(false), ParseIntPipe) page,
    @Query('limit', new DefaultValuePipe(false), ParseIntPipe) limit,
  ): Promise<any> {
    let items = await this.clustersEntityService.findMany({
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

  // @Get('by_pair_id_and_tf_and_ts')
  // @ApiOkResponse({ description: 'Get kline by pair_id, tf and ts' })
  // @HttpCode(HttpStatus.OK)
  // public async byPairIdAndTfAndTs(
  //   @Query('pairId', new DefaultValuePipe(false), ParseIntPipe) pairId,
  //   @Query('tf', new DefaultValuePipe(false), ParseIntPipe) tf,
  //   @Query('ts', new DefaultValuePipe(false), ParseIntPipe) ts,
  // ): Promise<any> {
  //   const kline = await this.clustersEntityService.findFirst({
  //     where: {
  //       pairId,
  //       interval: tf,
  //       ts,
  //     },
  //   });
  //
  //   if (!kline) {
  //     throw new NotFoundException('Kline not found');
  //   }
  //
  //   return kline;
  // }
}
