import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  BidaskStreamPayload,
  WebsocketStreamService,
} from './websocket-stream.service';

type WsBidaskSubscription = {
  ws: WebSocket;
  tf: number;
  pairId: number;
};

@Injectable()
export class WebsocketGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebsocketGatewayService.name);
  private readonly bidaskSubscriptions = new Map<
    string,
    WsBidaskSubscription
  >();
  private readonly bidaskSubscriptionsByPairId = new Map<
    string,
    WsBidaskSubscription
  >();
  private readonly bidaskSubscriptionsByPairIdAndTf = new Map<
    string,
    WsBidaskSubscription
  >();
  private wss?: WebSocketServer;
  private unsubscribeBidask?: () => void;

  constructor(private readonly websocketStream: WebsocketStreamService) {}

  onModuleInit() {
    const port = Number(process.env.WS_PORT);
    if (!port) {
      this.logger.warn('WS_PORT is not set; WebSocket server not started.');
      return;
    }

    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.unsubscribeBidask = this.websocketStream.onBidask((payload) =>
      this.broadcastBidask(payload),
    );

    this.logger.log(`WebSocket server listening on ws://localhost:${port}`);
  }

  onModuleDestroy() {
    this.unsubscribeBidask?.();
    this.wss?.close();
  }

  private handleConnection(ws: WebSocket) {
    const connectionId = uuidv4();
    (ws as any).id = connectionId;
    this.logger.log(`Client connected: ${connectionId}`);

    ws.on('message', (msg) => this.handleMessage(ws, msg));
    ws.on('close', () => {
      this.bidaskSubscriptions.delete(connectionId);
      this.logger.log(`Client disconnected: ${connectionId}`);
    });
  }

  private handleMessage(ws: WebSocket, msg: WebSocket.RawData) {
    try {
      const data = JSON.parse(msg.toString());
      if (
        data.type === 'subscribeBidaskByPairIdAndTf' &&
        data.pairId &&
        data.tf
      ) {
        const connectionId = (ws as any).id;
        this.bidaskSubscriptionsByPairIdAndTf.set(connectionId, {
          ws,
          tf: data.tf,
          pairId: data.pairId,
        });
        this.logger.log(
          `Client subscribed to bidask: ${data.pairId} @ ${data.tf}`,
        );
      } else if (
        data.type === 'subscribeBidaskByPairId' &&
        data.pairId &&
        data.tf
      ) {
        const connectionId = (ws as any).id;
        this.bidaskSubscriptionsByPairId.set(connectionId, {
          ws,
          tf: data.tf,
          pairId: data.pairId,
        });
        this.logger.log(
          `Client subscribed to bidask: ${data.pairId} @ ${data.tf}`,
        );
      } else if (data.type === 'subscribeBidask') {
        const connectionId = (ws as any).id;
        this.bidaskSubscriptions.set(connectionId, {
          ws,
          tf: data.tf,
          pairId: data.pairId,
        });
        this.logger.log(
          `Client subscribed to bidask: ${data.pairId} @ ${data.tf}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message.', error as Error);
    }
  }

  private broadcastBidask(payload: BidaskStreamPayload) {
    const subscriptions = Array.from(this.bidaskSubscriptions.values());
    for (const wsData of subscriptions) {
      if (wsData.ws.readyState === WebSocket.OPEN) {
        wsData.ws.send(
          JSON.stringify({
            type: 'bidask',
            data: {
              pairId: payload.pairId,
              tf: payload.tf,
              ts: payload.ts.toString(),
              data: payload.data,
              v: payload.v,
            },
          }),
        );
      }
    }

    const subscriptionsByPairId = Array.from(
      this.bidaskSubscriptionsByPairId.values(),
    );
    for (const wsData of subscriptionsByPairId) {
      if (
        wsData.ws.readyState === WebSocket.OPEN &&
        wsData.pairId === payload.pairId
      ) {
        wsData.ws.send(
          JSON.stringify({
            type: 'bidask',
            data: {
              pairId: payload.pairId,
              tf: payload.tf,
              ts: payload.ts.toString(),
              data: payload.data,
              v: payload.v,
            },
          }),
        );
      }
    }

    const subscriptionsByPairIdAndTf = Array.from(
      this.bidaskSubscriptionsByPairIdAndTf.values(),
    );
    for (const wsData of subscriptionsByPairIdAndTf) {
      if (
        wsData.ws.readyState === WebSocket.OPEN &&
        wsData.tf === payload.tf &&
        wsData.pairId === payload.pairId
      ) {
        wsData.ws.send(
          JSON.stringify({
            type: 'bidask',
            data: {
              pairId: payload.pairId,
              tf: payload.tf,
              ts: payload.ts.toString(),
              data: payload.data,
              v: payload.v,
            },
          }),
        );
      }
    }
  }
}
