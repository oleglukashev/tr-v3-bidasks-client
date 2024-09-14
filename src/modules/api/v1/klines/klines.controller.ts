import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { KlinesEntityService } from '../../../entity-services/klines-entity-service';

@ApiTags('Klines')
@Controller({ path: 'api/v1' })
export class ApiKlinesController {
  constructor(private readonly klinesEntityService: KlinesEntityService) {}

  @Get('/pairs/:pairId/klines')
  @ApiOkResponse({
    description: 'List of klines by pair id',
  })
  public async index(
    @Param('pairId', new DefaultValuePipe(0), ParseIntPipe) pairId,
  ): Promise<any> {
    return this.klinesEntityService.findMany({
      where: { pairId },
    });
  }
}
