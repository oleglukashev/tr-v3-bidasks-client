'use strict';

/**
 * Exchange-sharded sweep detector (по образцу all-liquidations.js / index4.js).
 *
 * "Sweep" — одна агрессивная рыночная заявка, пробившая несколько ценовых уровней (крупный игрок).
 * Стакана у клиента нет, поэтому уровни определяем по СДЕЛКАМ: группа трейдов с одинаковой стороной
 * (side) и одним timestamp (одна тейкер-заявка) считается sweep, если исполнила >= minLevels РАЗНЫХ
 * цен И суммарный quote-объём >= minNotionalUsd. Пороги — configs/base.json.sweep или env.
 *
 * Каждый sweep шлём в tr-v3-bidasks: { type: 'sweep', data: { pairId, tradingServiceId, side,
 * levels, amount, quoteVolume, priceStart, priceEnd, ts } }. side — сторона тейкера: buy → цена
 * вверх, sell → вниз (тот же маппинг, что и у ликвидаций).
 *
 * Резолв символов и upstream переиспользуем из движка index.js. Сбор трейдов свой (отдельное
 * ws-соединение), чтобы не трогать трейд→кластер конвейер index4.js.
 *
 * Usage:
 *   node all-sweeps.js <exchange> [i/n]
 *     node all-sweeps.js bybit        → bybit, все монеты (1 multiplexed ws)
 *     node all-sweeps.js mexc 1/3     → mexc, подшард 1 из 3 монет
 *     node all-sweeps.js all          → каждая биржа (все монеты)
 *
 * Env: BIDASKS_API_URL, BIDASKS_UPSTREAM_WS_URL, UPSTREAM_RECONNECT_MS, EXCHANGE, SUBSHARD,
 *      MAX_STREAMS_PER_CONN, SUBSCRIBE_DELAY_MS, SWEEP_MIN_LEVELS, SWEEP_MIN_NOTIONAL_USD,
 *      SWEEP_JOIN_WINDOW_MS.
 */

require('dns').setDefaultResultOrder('ipv4first');

const ccxt = require('ccxt');

const {
  loadConfig,
  selectServices,
  mapWithConcurrency,
  resolveExchangeEntry,
  UpstreamWs,
  CONFIG_FETCH_CONCURRENCY,
  parseArgs,
  setDebugName,
} = require('./index.js');

const CCXT_FUTURES_ID = {
  kucoin: 'kucoinfutures',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errMsg = (err) => (err && (err.message || err.name)) || String(err) || 'unknown';

const RATE_LIMIT_RE = /too frequent|too many|rate ?limit|frequently|\b429\b|\b510\b/i;
const CONN_ISSUE_RE = /timed out|connection|keepalive|econn|network|socket hang|handshake/i;
const retryDelay = (msg) =>
  RATE_LIMIT_RE.test(msg) ? 5000 : CONN_ISSUE_RE.test(msg) ? 3000 : 1000;

// Пока группа не финализирована, ждём этот интервал тишины по символу и закрываем её (fills одной
// заявки могут прийти в разных ws-сообщениях с тем же ts).
const FLUSH_DELAY_MS = 150;

const SUBSCRIBE_DELAY_MS_BY_EXCHANGE = { mexc: 1000, gate: 300, bitget: 300 };

/** Slice `names` into the i-th of n contiguous parts. Empty spec → all names. */
function sliceNames(names, spec) {
  if (!spec) return names;
  const m = /^(\d+)\/(\d+)$/.exec(String(spec).trim());
  if (!m) throw new Error(`Sub-shard must look like "i/n" (напр. 1/3), got: ${spec}`);
  const i = Number(m[1]);
  const n = Number(m[2]);
  if (i < 1 || i > n) throw new Error(`Sub-shard ${i}/${n} вне диапазона`);
  const size = Math.ceil(names.length / n);
  return names.slice((i - 1) * size, (i - 1) * size + size);
}

/** Копия resolveSymbol из index.js (там не экспортируется): только USDT-perp (swap). */
function resolveSymbol(market, rawSymbol) {
  const perp = (rawSymbol || '').replace('USDT', '/USDT:USDT');
  for (const cand of [perp, rawSymbol]) {
    if (!cand) continue;
    const m = market.markets && market.markets[cand];
    if (m && m.swap) return cand;
    const byId = market.markets_by_id && market.markets_by_id[cand];
    if (byId) {
      const arr = Array.isArray(byId) ? byId : [byId];
      const swap = arr.find((x) => x && x.swap);
      if (swap) return swap.symbol;
    }
  }
  return null;
}

/**
 * Детектор sweep'ов по потоку трейдов. Группирует последовательные трейды одной стороны с одним ts
 * (в пределах joinWindowMs) по символу; финализирует группу, когда приходит несовпадающий трейд или
 * истекает FLUSH_DELAY_MS тишины. Группа = sweep, если разных цен >= minLevels и quote-объём >=
 * minNotionalUsd. Вызывает onSweep(symbol, sweep).
 */
function makeSweepDetector({ minLevels, minNotional, joinWindowMs, onSweep }) {
  const groups = new Map(); // symbol -> group
  const timers = new Map(); // symbol -> timeout

  const finalize = (symbol) => {
    const g = groups.get(symbol);
    groups.delete(symbol);
    const t = timers.get(symbol);
    if (t) { clearTimeout(t); timers.delete(symbol); }
    if (!g) return;
    if (g.prices.size >= minLevels && g.notional >= minNotional) {
      onSweep(symbol, {
        side: g.side,
        levels: g.prices.size,
        amount: g.amount,
        quoteVolume: g.notional,
        priceStart: g.priceFirst,
        priceEnd: g.priceLast,
        ts: g.ts,
      });
    }
  };

  const scheduleFlush = (symbol) => {
    const old = timers.get(symbol);
    if (old) clearTimeout(old);
    timers.set(symbol, setTimeout(() => finalize(symbol), FLUSH_DELAY_MS));
  };

  // trade: { ts, price, amount(base), side } — amount уже в базовой монете.
  const add = (symbol, trade) => {
    const { ts, price, amount, side } = trade;
    if (!Number.isFinite(price) || !Number.isFinite(amount) || amount <= 0 || !side) return;
    let g = groups.get(symbol);
    const joins = g && g.side === side && ts >= g.ts && ts - g.ts <= joinWindowMs;
    if (!joins) {
      if (g) finalize(symbol); // финализируем предыдущую (finalize её удаляет)
      g = { side, ts, prices: new Set(), amount: 0, notional: 0, priceFirst: price, priceLast: price };
      groups.set(symbol, g);
    }
    g.prices.add(price);
    g.amount += amount;
    g.notional += price * amount;
    g.priceLast = price;
    scheduleFlush(symbol);
  };

  return { add };
}

async function runExchangeSweeps({ exCfg, upstream, sweepCfg }) {
  const exchangeId = exCfg.id;
  const tradingServiceId = exCfg.tradingServiceId;
  const ccxtId = CCXT_FUTURES_ID[exchangeId] || exchangeId;
  const ExchangeClass = ccxt.pro[ccxtId];
  if (!ExchangeClass) {
    console.error(`[${exchangeId}] ccxt.pro.${ccxtId} недоступен — пропуск`);
    return;
  }

  const pairs = exCfg.pairs || [];
  if (!pairs.length) {
    console.warn(`[${exchangeId}] пропуск: пустые pairs`);
    return;
  }

  const createExchange = () =>
    new ExchangeClass({
      enableRateLimit: true,
      options: {
        defaultType: exCfg.defaultType ?? 'linear',
        ...(exCfg.options ?? {}),
      },
    });

  // loadMarkets один раз — резолвим символы, contractSize и поддержку multiplex.
  let market = null;
  while (true) {
    try {
      market = createExchange();
      await market.loadMarkets();
      break;
    } catch (e) {
      console.error(`[${exchangeId}] connect: ${errMsg(e)}`);
      try { await market?.close?.(); } catch (_) {}
      market = null;
      await sleep(2000);
    }
  }

  const supportsMulti = !!(market.has && market.has['watchTradesForSymbols']);

  const streams = [];
  const skipped = [];
  for (const p of pairs) {
    const sym = resolveSymbol(market, p.symbol);
    if (!sym) { skipped.push(p.symbol); continue; }
    const cs = Number(market.markets[sym] && market.markets[sym].contractSize);
    streams.push({ symbol: sym, pairId: p.pairId, contractSize: cs > 0 ? cs : 1 });
  }

  try { await market.close?.(); } catch (_) {}

  if (!streams.length) {
    console.error(`[${exchangeId}] нет валидных символов — стоп`);
    return;
  }

  const skippedNote = skipped.length ? `, skipped: ${skipped.join(', ')}` : '';
  const symbols = streams.map((s) => s.symbol);
  const pairIdBySymbol = new Map(streams.map((s) => [s.symbol, s.pairId]));
  const csBySymbol = new Map(streams.map((s) => [s.symbol, s.contractSize]));

  const detector = makeSweepDetector({
    minLevels: sweepCfg.minLevels,
    minNotional: sweepCfg.minNotional,
    joinWindowMs: sweepCfg.joinWindowMs,
    onSweep: (symbol, sweep) => {
      const pairId = pairIdBySymbol.get(symbol);
      if (pairId == null) return;
      const data = {
        pairId,
        tradingServiceId,
        side: sweep.side,
        levels: sweep.levels,
        amount: String(sweep.amount),
        quoteVolume: sweep.quoteVolume,
        priceStart: String(sweep.priceStart),
        priceEnd: String(sweep.priceEnd),
        ts: sweep.ts,
      };
      console.log(`[sweep ${exchangeId}]`, JSON.stringify({ symbol, ...data }));
      upstream.send('sweep', data);
    },
  });

  const feed = (trades) => {
    if (!trades || !trades.length) return;
    for (const t of trades) {
      if (t == null) continue;
      const price = Number(t.price);
      const cs = csBySymbol.get(t.symbol) || 1;
      const amount = Number(t.amount) * cs;
      const side = String(t.side || '').toLowerCase();
      if (!Number.isFinite(price) || !Number.isFinite(amount)) continue;
      detector.add(t.symbol, { ts: t.timestamp, price, amount, side });
    }
  };

  // Общий инстанс на все watch-циклы одной биржи.
  let shared = null;
  const ensureExchange = () => {
    if (!shared) shared = createExchange();
    return shared;
  };
  const resetExchange = () => {
    const old = shared;
    shared = null;
    try { old?.close?.()?.catch?.(() => {}); } catch (_) {}
  };

  // Fast path: одно соединение на все символы.
  if (supportsMulti && streams.length > 1) {
    console.log(`[${exchangeId}] watchTradesForSymbols: ${symbols.length} symbols / 1 conn${skippedNote}`);
    while (true) {
      try {
        const ex = ensureExchange();
        const trades = await ex.watchTradesForSymbols(symbols);
        feed(trades);
      } catch (err) {
        const msg = errMsg(err);
        console.error(`[${exchangeId}] sweeps: ${msg}`);
        resetExchange();
        await sleep(retryDelay(msg));
      }
    }
  }

  // Fallback: по циклу на символ (с throttle подписки, как в index.js).
  const gapMs = Math.max(
    Number(exCfg.subscribeDelayMs) || 200,
    SUBSCRIBE_DELAY_MS_BY_EXCHANGE[exchangeId] || 0,
  );
  let gateChain = Promise.resolve();
  const subscribeGate = () => {
    gateChain = gateChain.then(() => new Promise((r) => setTimeout(r, gapMs)));
    return gateChain;
  };

  console.log(`[${exchangeId}] watchTrades: ${symbols.length} streams${skippedNote}`);
  const streamLoop = async (symbol) => {
    let subscribed = false;
    while (true) {
      try {
        const ex = ensureExchange();
        if (!subscribed) await subscribeGate();
        const trades = await ex.watchTrades(symbol);
        subscribed = true;
        feed(trades);
      } catch (err) {
        subscribed = false;
        const msg = errMsg(err);
        console.error(`[${exchangeId}] ${symbol}: ${msg}`);
        await sleep(retryDelay(msg));
      }
    }
  };
  await Promise.all(symbols.map(streamLoop));
}

async function main() {
  const config = loadConfig();

  const wsUrl =
    process.env.BIDASKS_UPSTREAM_WS_URL ||
    config.upstream?.wsUrl ||
    'ws://bidasks.traken-trade.ru/ws/';
  const reconnectMs =
    Number(config.upstream?.reconnectMs) ||
    Number(process.env.UPSTREAM_RECONNECT_MS) ||
    5000;

  const apiUrl = process.env.BIDASKS_API_URL || config.apiUrl;
  const names = config.names || [];
  const tradingServices = config.tradingServices || {};

  const sweepCfg = {
    minLevels:
      Number(process.env.SWEEP_MIN_LEVELS) ||
      Number(config.sweep?.minLevels) ||
      5,
    minNotional:
      Number(process.env.SWEEP_MIN_NOTIONAL_USD) ||
      Number(config.sweep?.minNotionalUsd) ||
      10000,
    joinWindowMs: Number(
      process.env.SWEEP_JOIN_WINDOW_MS ?? config.sweep?.joinWindowMs ?? 0,
    ),
  };

  const { positional, debug } = parseArgs(process.argv);
  if (debug) setDebugName(debug);

  const exArg = positional[0] || process.env.EXCHANGE;
  if (!exArg) {
    throw new Error(
      'Usage: node all-sweeps.js <exchange> [i/n]  (напр. node all-sweeps.js bybit  |  node all-sweeps.js mexc 1/3)',
    );
  }
  const serviceNames = selectServices(exArg, tradingServices);

  const shardSpec = positional[1] || process.env.SUBSHARD;
  if (shardSpec && serviceNames.length > 1) {
    throw new Error('Sub-shard (i/n) поддерживается только для одной биржи');
  }
  const shardNames = sliceNames(names, shardSpec);

  const maxStreamsPerConn =
    Number(process.env.MAX_STREAMS_PER_CONN) ||
    Number(config.maxStreamsPerConn) ||
    undefined;
  const subscribeDelayMs =
    Number(process.env.SUBSCRIBE_DELAY_MS) ||
    Number(config.subscribeDelayMs) ||
    undefined;

  const entries = serviceNames.map((sname) => ({
    tradingServiceId: tradingServices[sname],
    names: shardNames,
    maxStreamsPerConn,
    subscribeDelayMs,
  }));

  console.log(
    `[start] sweeps exchange-shard: ${serviceNames.join(', ')} × ${shardNames.length} pairs` +
      (shardSpec ? ` (sub-shard ${shardSpec})` : '') +
      ` | minLevels=${sweepCfg.minLevels}, minNotionalUsd=${sweepCfg.minNotional}`,
  );

  const exchanges = (
    await mapWithConcurrency(entries, CONFIG_FETCH_CONCURRENCY, (entry) =>
      resolveExchangeEntry(entry, apiUrl).catch((err) => {
        console.error(`[config] TS=${entry.tradingServiceId}: ${err.message}`);
        return null;
      }),
    )
  ).filter(Boolean);

  if (!exchanges.length) {
    throw new Error('config: не удалось получить ни одной биржи с парами');
  }

  const upstream = new UpstreamWs(wsUrl, reconnectMs);
  upstream.start();

  await Promise.all(
    exchanges.map((exCfg) => runExchangeSweeps({ exCfg, upstream, sweepCfg })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
