import { Module } from '@nestjs/common';
import { ApiPairsController } from './pairs.controller';

@Module({
  controllers: [ApiPairsController],
})
export class ApiPairsModule {}
