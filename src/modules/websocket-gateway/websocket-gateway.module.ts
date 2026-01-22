import { Module } from '@nestjs/common';
import { WebsocketGatewayService } from './websocket-gateway.service';
import { WebsocketStreamService } from './websocket-stream.service';

@Module({
  providers: [WebsocketGatewayService, WebsocketStreamService],
  exports: [WebsocketStreamService],
})
export class WebsocketGatewayModule {}
