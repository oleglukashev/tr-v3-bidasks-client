import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { StrategySessionsEntityService } from '../../../entity-services/strategy-sessions-entity-service';
import { CreateDto } from './dto/create.dto';
import { UpdateDto } from './dto/update.dto';
import { KlinesEntityService } from '../../../entity-services/klines-entity-service';

@Injectable()
export class ApiDhmService {
  constructor(
    private readonly dhmEntityService: StrategySessionsEntityService,
    private readonly klinesEntityService: KlinesEntityService,
  ) {}

  async create(createDto: CreateDto) {
    const existSession = await this.dhmEntityService.findFirst({
      where: {
        pairId: createDto.pairId,
        startTs: createDto.kline1Ts,
      },
    });

    if (existSession) {
      throw new UnprocessableEntityException('Session already exist');
    }

    const kline1 = await this.klinesEntityService.findFirst({
      where: {
        ts: createDto.kline1Ts,
        interval: 60,
        pairId: createDto.pairId,
      },
    });

    if (!kline1) {
      throw new UnprocessableEntityException('Kline1 is not exist');
    }

    const kline2 = await this.klinesEntityService.findFirst({
      where: {
        ts: createDto.kline2Ts,
        interval: 60,
        pairId: createDto.pairId,
      },
    });

    if (!kline2) {
      throw new UnprocessableEntityException('Kline2 is not exist');
    }

    const strategyDirection =
      kline1.high > kline2.low && kline1.high < kline2.high ? 'up' : 'down';

    return this.dhmEntityService.baseCreate({
      pairId: createDto.pairId,
      startTs: kline1.ts,
      type: 'dhm',
      status: createDto.status,
      direction: strategyDirection,
      data: {
        kline1Id: kline1.id,
        kline2Id: kline2.id,
        kline1: kline1,
        kline2: kline2,
        low: strategyDirection === 'up' ? kline1.low : kline2.low,
        high: strategyDirection === 'up' ? kline2.high : kline1.high,
      },
    });
  }

  async update(updateDto: UpdateDto) {
    // return this.dhmEntityService.baseCreate({
    //   ...createDto,
    //   prices,
    // });
  }
}
