import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export type BidaskStreamPayload = {
  pairId: number;
  tf: number;
  ts: number;
  data: Record<string, any>;
  v: number;
};

@Injectable()
export class WebsocketStreamService {
  private readonly emitter = new EventEmitter();
  private readonly bidaskEvent = 'bidask';

  onBidask(handler: (payload: BidaskStreamPayload) => void): () => void {
    this.emitter.on(this.bidaskEvent, handler);
    return () => this.emitter.off(this.bidaskEvent, handler);
  }

  emitBidask(payload: BidaskStreamPayload) {
    this.emitter.emit(this.bidaskEvent, payload);
  }
}
