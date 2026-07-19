'use strict';

// Чистый ccxt.pro: watchTrades по pairId, печать поступающих сделок.
//   node index3.js <pairId>
require('dns').setDefaultResultOrder('ipv4first');
const ccxt = require('ccxt');

const API_URL = process.env.BIDASKS_API_URL || 'http://api.traken-trade.ru/api/v1';
const CCXT_FUTURES_ID = { kucoin: 'kucoinfutures' };
const getJson = async (u) => (await fetch(u)).json();

(async () => {
  const pairId = Number(process.argv[2]);

  const pair = (await getJson(`${API_URL}/pairs`)).find((p) => p.id === pairId);
  const symbol = pair.symbol.replace('USDT', '/USDT:USDT');

  // Биржа берётся из самой пары (tradingService.ccxtId), а не хардкодом.
  const ts = pair.tradingService || {};
  const ccxtId = CCXT_FUTURES_ID[ts.ccxtId] || ts.ccxtId;
  console.log(`pairId=${pairId} ${pair.name} · ${ccxtId} · ${symbol}`);

  const exchange = new ccxt.pro[ccxtId]({
    options: { defaultType: ts.defaultType || 'linear' },
  });
  await exchange.loadMarkets();

  while (true) {
    const trades = await exchange.watchTrades(symbol);
    for (const t of trades) {
      console.log(t.side, 'price', t.price, 'amount', t.amount);
    }
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
