import { Global, Module } from '@nestjs/common';
import { BidasksStorageService } from './bidasks-storage.service';
import { WebsocketGatewayModule } from '../websocket-gateway/websocket-gateway.module';

@Global()
@Module({
  imports: [WebsocketGatewayModule],
  providers: [BidasksStorageService],
  exports: [BidasksStorageService],
})
export class BidasksStorageModule {}
