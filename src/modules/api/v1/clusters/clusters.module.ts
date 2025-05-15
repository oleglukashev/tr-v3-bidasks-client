import { Module } from '@nestjs/common';
import { ApiClustersController } from './clusters.controller';

@Module({
  imports: [],
  controllers: [ApiClustersController],
})
export class ApiClustersModule {}
