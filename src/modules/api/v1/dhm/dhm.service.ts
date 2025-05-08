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
      confirmed: createDto.confirmed,
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

  async update(id: number, updateDto: UpdateDto) {
    const existSession = await this.dhmEntityService.findFirst({
      where: { id },
    });

    if (!existSession) {
      throw new UnprocessableEntityException('Session is not exist');
    }

    const kline1 = await this.klinesEntityService.findFirst({
      where: {
        ts: updateDto.kline1Ts,
        interval: 60,
        pairId: existSession.pairId,
      },
    });

    if (!kline1) {
      throw new UnprocessableEntityException('Kline1 is not exist');
    }

    const kline2 = await this.klinesEntityService.findFirst({
      where: {
        ts: updateDto.kline2Ts,
        interval: 60,
        pairId: existSession.pairId,
      },
    });

    if (!kline2) {
      throw new UnprocessableEntityException('Kline2 is not exist');
    }

    const data: any = {
      startTs: kline1.ts,
      status: updateDto.status,
      confirmed: updateDto.confirmed,
      data: {
        kline1Id: kline1.id,
        kline2Id: kline2.id,
        kline1: kline1,
        kline2: kline2,
      },
    };

    if (updateDto.kline1Ts !== parseInt(kline1.id)) {
      const newKline1 = await this.klinesEntityService.findFirst({
        where: {
          ts: updateDto.kline1Ts,
        },
      });
      if (!newKline1) {
        throw new UnprocessableEntityException('Kline1 is not exist');
      }
      data.data.kline1Id = newKline1.id;
      data.data.kline1 = newKline1;
      if (existSession.direction === 'up') {
        if (parseFloat(newKline1.low) < parseFloat(existSession.data.low)) {
          data.data.low = newKline1.low;
        }
      } else {
        if (parseFloat(newKline1.high) > parseFloat(existSession.data.high)) {
          data.data.high = newKline1.high;
        }
      }
    }

    if (updateDto.kline2Ts !== parseInt(kline2.id)) {
      const newKline2 = await this.klinesEntityService.findFirst({
        where: {
          ts: updateDto.kline2Ts,
        },
      });
      if (!newKline2) {
        throw new UnprocessableEntityException('Kline2 is not exist');
      }
      data.data.kline2Id = newKline2.id;
      data.data.kline2 = newKline2;
      if (existSession.direction === 'up') {
        if (parseFloat(newKline2.high) > parseFloat(existSession.data.high)) {
          data.data.high = newKline2.high;
        }
      } else {
        if (parseFloat(newKline2.low) < parseFloat(existSession.data.low)) {
          data.data.low = newKline2.low;
        }
      }
    }

    return this.dhmEntityService.baseUpdate(id, data);
  }
}
