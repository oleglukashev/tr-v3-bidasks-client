import { Module } from '@nestjs/common';
import { ApiDhmController } from './dhm.controller';
import { ApiDhmService } from './dhm.service';

@Module({
  imports: [],
  controllers: [ApiDhmController],
  providers: [ApiDhmService],
  exports: [ApiDhmService],
})
export class ApiDhmModule {}
