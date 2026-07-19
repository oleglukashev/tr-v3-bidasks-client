'use strict';

/**
 * Диагностика одного pairId: подключается к нужной бирже (ccxt.pro watchTrades)
 * и печатает поступающие сделки (сырой первый ответ + rolling).
 *   node index2.js <pairId>
 * Env: BIDASKS_API_URL (иначе apiUrl из configs/base.json).
 */

// Тот же фикс, что в index.js — предпочитать IPv4 (битый IPv6 на боксе ломает bybit/okx).
require('dns').setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const ccxt = require('ccxt');

const CCXT_FUTURES_ID = { kucoin: 'kucoinfutures' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadConfig() {
  const p =
    process.env.BIDASKS_CLIENT_CONFIG || path.join(__dirname, 'configs', 'base.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function fetchPair(apiUrl, pairId) {
  const base = String(apiUrl).replace(/\/+$/, '');
  const res = await fetch(`${base}/pairs`);
  if (!res.ok) throw new Error(`GET ${base}/pairs → ${res.status} ${res.statusText}`);
  const pairs = await res.json();
  const pair = (pairs || []).find((p) => Number(p.id) === Number(pairId));
  if (!pair) throw new Error(`pairId ${pairId} не найден`);
  return pair;
}

async function main() {
  const pairId = Number(process.argv[2]);
  if (!Number.isFinite(pairId)) throw new Error('Usage: node index2.js <pairId>');

  const config = loadConfig();
  const apiUrl = process.env.BIDASKS_API_URL || config.apiUrl;

  const pair = await fetchPair(apiUrl, pairId);
  const ts = pair.tradingService || {};
  const exchangeId = ts.ccxtId;
  if (!exchangeId) throw new Error(`у пары ${pairId} не задан tradingService.ccxtId`);

  const ccxtId = CCXT_FUTURES_ID[exchangeId] || exchangeId;
  const ExchangeClass = ccxt.pro[ccxtId];
  if (!ExchangeClass) throw new Error(`ccxt.pro.${ccxtId} недоступен`);

  const exchange = new ExchangeClass({
    enableRateLimit: true,
    options: { defaultType: ts.defaultType || 'linear' },
  });
  await exchange.loadMarkets();

  // Только USDT-перп (swap): перп-нотация в приоритете, затем symbol; спот не берём.
  const perp = (pair.symbol || '').replace('USDT', '/USDT:USDT');
  let symbol = null;
  for (const cand of [perp, pair.symbol]) {
    if (!cand) continue;
    const m = exchange.markets && exchange.markets[cand];
    if (m && m.swap) {
      symbol = cand;
      break;
    }
    const byId = exchange.markets_by_id && exchange.markets_by_id[cand];
    if (byId) {
      const arr = Array.isArray(byId) ? byId : [byId];
      const swap = arr.find((x) => x && x.swap);
      if (swap) {
        symbol = swap.symbol;
        break;
      }
    }
  }
  if (!symbol) throw new Error(`swap-символ для ${pair.symbol} не найден на ${exchangeId}`);

  const cs = Number(exchange.markets[symbol] && exchange.markets[symbol].contractSize) || 1;
  console.log(`[index2] pairId=${pairId} ${pair.name} · ${exchangeId} · ${symbol} · contractSize=${cs}`);

  // Печатаем сделки как отдаёт биржа (после нормализации: amount × contractSize).
  let dumped = false;
  while (true) {
    try {
      const trades = await exchange.watchTrades(symbol);
      if (!trades || !trades.length) continue;
      if (!dumped) {
        dumped = true;
        console.log('--- raw trades[0].info (нативный ответ биржи) ---');
        console.log(JSON.stringify(trades[0].info, null, 2));
        console.log('--- /raw ---');
      }
      for (const t of trades) {
        console.log(
          `${new Date(t.timestamp).toISOString()}  ${t.side}\tprice=${t.price}\tamount=${Number(t.amount) * cs}`,
        );
      }
    } catch (err) {
      const msg = (err && (err.message || err.name)) || String(err);
      console.error('watch error:', msg);
      await sleep(1000);
    }
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
