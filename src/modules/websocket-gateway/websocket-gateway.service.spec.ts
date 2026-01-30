import { Test, TestingModule } from '@nestjs/testing';
import WebSocket from 'ws';
import { WebsocketGatewayService } from './websocket-gateway.service';
import { WebsocketStreamService } from './websocket-stream.service';
import { BidasksStorageService } from '../bidasks-storage/bidasks-storage.service';

const makeWs = (id: string) => {
  const ws = {
    id,
    send: jest.fn(),
    readyState: WebSocket.OPEN,
  } as unknown as WebSocket;

  return ws;
};

describe('WebsocketGatewayService', () => {
  let service: WebsocketGatewayService;
  let bidasksStorageService: BidasksStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGatewayService,
        WebsocketStreamService,
        BidasksStorageService,
      ],
    }).compile();

    service = module.get(WebsocketGatewayService);
    bidasksStorageService = module.get(BidasksStorageService);
  });

  it('approves subscribeBidasksClient', () => {
    const ws = makeWs('client-1');

    (service as any).handleMessage(
      ws,
      Buffer.from(JSON.stringify({ type: 'subscribeBidasksClient' })),
    );

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ approved: true }));
    expect((ws as any).isBidasksClient).toBe(true);
  });

  it('stores and broadcasts incoming bidasks to subscribers', () => {
    const wsAll = makeWs('all');
    const wsPair = makeWs('pair');
    const wsPairTf = makeWs('pair-tf');
    const wsClient = makeWs('client');

    (service as any).handleMessage(
      wsAll,
      Buffer.from(
        JSON.stringify({
          type: 'subscribeBidasks',
          pairId: 1,
          tf: 1,
        }),
      ),
    );
    (service as any).handleMessage(
      wsPair,
      Buffer.from(
        JSON.stringify({
          type: 'subscribeBidasksByPairId',
          pairId: 1,
          tf: 1,
        }),
      ),
    );
    (service as any).handleMessage(
      wsPairTf,
      Buffer.from(
        JSON.stringify({
          type: 'subscribeBidasksByPairIdAndTf',
          pairId: 1,
          tf: 1,
        }),
      ),
    );

    (service as any).handleMessage(
      wsClient,
      Buffer.from(JSON.stringify({ type: 'subscribeBidasksClient' })),
    );

    const bidasks = [
      { pairId: 1, tf: 1, ts: 100, data: { v: 1 }, v: 1 },
      { pairId: 2, tf: 5, ts: 200, data: { v: 2 }, v: 2 },
    ];
    const setBidasksSpy = jest.spyOn(bidasksStorageService, 'setBidasks');

    (service as any).handleMessage(
      wsClient,
      Buffer.from(JSON.stringify(bidasks)),
    );

    expect(setBidasksSpy).toHaveBeenCalledWith(bidasks);

    const allMessage = JSON.parse((wsAll as any).send.mock.calls[0][0]);
    expect(allMessage.type).toBe('bidasks');
    expect(allMessage.data).toHaveLength(2);

    const pairMessage = JSON.parse((wsPair as any).send.mock.calls[0][0]);
    expect(pairMessage.data).toHaveLength(1);
    expect(pairMessage.data[0].pairId).toBe(1);

    const pairTfMessage = JSON.parse(
      (wsPairTf as any).send.mock.calls[0][0],
    );
    expect(pairTfMessage.data).toHaveLength(1);
    expect(pairTfMessage.data[0].pairId).toBe(1);
    expect(pairTfMessage.data[0].tf).toBe(1);
  });
});
