import { Injectable } from '@nestjs/common';
import { BidasksStorageService } from './modules/bidasks-storage/bidasks-storage.service';
import sleep from './utils/sleep';
import { WebsocketStreamService } from './modules/websocket-gateway/websocket-stream.service';

@Injectable()
export class AppService {
  constructor(
    private readonly bidasksStorageService: BidasksStorageService,
    private readonly websocketStreamService: WebsocketStreamService,
  ) {}

  async init(): Promise<any> {
    //this.bidasksStream();
  }

  private async bidasksStream() {
    while (true) {
      const bidasks: any = this.bidasksStorageService.getBidasks();
      this.websocketStreamService.emitBidasks(bidasks);
      await sleep(5000);
    }
  }
}
