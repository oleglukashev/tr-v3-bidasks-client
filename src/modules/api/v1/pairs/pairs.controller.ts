import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, HttpStatus, Get, HttpCode } from '@nestjs/common';
import { PairsEntityService } from '../../../entity-services/pairs-entity-service';

@ApiTags('Pairs')
@ApiBearerAuth()
@Controller({ path: 'api/v1/pairs' })
export class ApiPairsController {
  constructor(private readonly pairsEntityService: PairsEntityService) {}

  @Get('')
  @ApiOkResponse({ description: 'List of pairs' })
  @HttpCode(HttpStatus.OK)
  public async index(): Promise<any> {
    return this.pairsEntityService.findMany({});
  }
}
