# tr-v3-bidasks trade relay

Тонкий CCXT-Pro релей трейдов в upstream WS `tr-v3-bidasks` — источник для построения
bid/ask-кластеров и xv-range баров (+ footprint). Организован по образцу `tr-v3-orderbooks-client`:
конфиг + позиционные аргументы + PM2, запуск набором по бирже × набору монет.

Собирает трейды (`watchTrades` / `watchTradesForSymbols`) и шлёт каждый батч как

```json
{ "type": "trades", "data": { "pairId": 123, "tradingServiceId": 2,
  "trades": [{ "ts": 1710000000000, "price": 0.12, "amount": 1000, "side": "buy" }] } }
```

после хендшейка `{ "type": "subscribeTradeClients" }` → ждём `{ "subscription": true }`.
xv-range и cluster строит сервер `tr-v3-bidasks`, релей их не считает.

## Конфиг

`configs/base.json` (или путь в `BIDASKS_CLIENT_CONFIG`):
- `upstream.wsUrl` — WS-вход сервера bidasks (env `BIDASKS_UPSTREAM_WS_URL`).
- `apiUrl` — tr-v3-api, резолв пар: `GET {apiUrl}/exchanges/{tsId}/pairs-by-names?names=...` (env `BIDASKS_API_URL`).
- `tradingServices` — имя биржи → tradingServiceId.
- `names` — монеты (`BTCUSDT`, ...).
- `chunkSize`, `maxStreamsPerConn`, `subscribeDelayMs`.

## Запуск

Два режима шардинга (движок общий, в `index.js`):

```bash
# по бирже × все монеты (рекомендуется, index4.js)
node index4.js bybit                 # bybit, все монеты (1 multiplexed ws)
node index4.js bybit,okx             # несколько лёгких multiplex-бирж в одном процессе
node index4.js phemex 1/3            # phemex, подшард 1 из 3 монет (для тяжёлых single-symbol бирж)
node index4.js bybit --debug KASUSDT # печать отправляемых трейдов по одной паре

# по чанку монет × биржи (index.js)
node index.js 1                      # чанк 1, все биржи
node index.js 2 bybit,okx            # чанк 2, только bybit и okx
```

PM2 набором:

```bash
pm2 start ecosystem.config.js            # все объявленные процессы
pm2 start ecosystem.config.js --only bybit
```

## Env

`BIDASKS_CLIENT_CONFIG`, `BIDASKS_API_URL`, `BIDASKS_UPSTREAM_WS_URL`, `UPSTREAM_RECONNECT_MS`,
`CHUNK`, `TRADING_SERVICES`, `EXCHANGE`, `SUBSHARD`, `MAX_STREAMS_PER_CONN`, `SUBSCRIBE_DELAY_MS`,
`BIDASKS_DEBUG`.

## Зависимости

`ccxt` и `ws` уже в `package.json`. Перед первым запуском: `yarn install`.
