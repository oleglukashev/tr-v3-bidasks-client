import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  HttpStatus,
  Query,
  DefaultValuePipe,
  Get,
  HttpCode,
  ParseIntPipe, Delete, Post, UsePipes, ValidationPipe, Body, Patch,
} from '@nestjs/common';
import { StrategySessionsEntityService } from '../../../entity-services/strategy-sessions-entity-service';
import { CreateDto } from './dto/create.dto';
import { ApiDhmService } from './dhm.service';
import { UpdateDto } from './dto/update.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller({ path: 'api/v1/dhm' })
export class ApiDhmController {
  constructor(
    private readonly strategySessionsEntityService: StrategySessionsEntityService,
    private readonly apiDhmService: ApiDhmService,
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

  @Post('')
  @ApiOkResponse({
    description: 'Create dhm',
    type: [CreateDto],
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.OK)
  public async create(@Body() createDto: CreateDto): Promise<any> {
    return this.apiDhmService.create(createDto);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'Update dhm',
    type: [UpdateDto],
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.OK)
  public async update(@Body() updateDto: UpdateDto): Promise<any> {
    return this.apiDhmService.update(updateDto);
  }

  @Delete('')
  @ApiOkResponse({ description: 'Delete all dhm strategies' })
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(): Promise<any> {
    await this.strategySessionsEntityService.baseRemoveAll();
  }
}
