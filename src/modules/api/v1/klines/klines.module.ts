import { Module } from '@nestjs/common';
import { ApiKlinesController } from './klines.controller';
import { ApiKlinesService } from './klines.service';

@Module({
  imports: [],
  controllers: [ApiKlinesController],
  providers: [ApiKlinesService],
  exports: [ApiKlinesService],
})
export class ApiKlinesModule {}
