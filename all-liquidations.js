'use strict';

/**
 * Exchange-sharded liquidation collector (по образцу index4.js).
 *
 * index4.js:         1 процесс = ОДНА биржа × ВСЕ монеты → watchTrades* → шлём трейды в upstream.
 * all-liquidations.js: та же ось шардинга, но вместо трейдов подписываемся на ПУБЛИЧНЫЕ ликвидации
 *                      (watchLiquidations / watchLiquidationsForSymbols) и шлём их в тот же upstream
 *                      (tr-v3-bidasks), где они сохраняются в таблицу `liquidations`.
 *                      Сообщение: { type: 'liquidation', data: { pairId, tradingServiceId, position,
 *                      price, contracts, ts } }. position: сторона ликвидационного ордера биржи,
 *                      смапленная buy → 'up', sell → 'down'.
 *
 * Резолв символов (какие монеты и по какой бирже) переиспользуем из движка index.js через
 * resolveExchangeEntry (тот же GET pairs-by-names к tr-v3-api). Сам сбор — свой, т.к. ccxt-методы
 * ликвидаций отличаются от watchTrades*.
 *
 * Не все биржи умеют ликвидации в ccxt: биржи без watchLiquidations[ForSymbols] тихо пропускаются.
 *
 * Usage:
 *   node all-liquidations.js <exchange> [i/n]
 *     node all-liquidations.js bybit         → bybit, все монеты
 *     node all-liquidations.js bybit,okx     → несколько бирж в одном процессе
 *     node all-liquidations.js phemex 1/3    → подшард 1 из 3 монет
 *     node all-liquidations.js all           → каждая биржа (все монеты)
 *
 * Env: как у index4.js (BIDASKS_API_URL, BIDASKS_UPSTREAM_WS_URL, UPSTREAM_RECONNECT_MS, EXCHANGE,
 *      SUBSHARD, MAX_STREAMS_PER_CONN, SUBSCRIBE_DELAY_MS).
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

// Exchanges whose USDT-perp markets live in a different ccxt class than the ccxtId
// (совпадает с CCXT_FUTURES_ID в index.js).
const CCXT_FUTURES_ID = {
  kucoin: 'kucoinfutures',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errMsg = (err) => (err && (err.message || err.name)) || String(err) || 'unknown';

const RATE_LIMIT_RE = /too frequent|too many|rate ?limit|frequently|\b429\b|\b510\b/i;
const CONN_ISSUE_RE = /timed out|connection|keepalive|econn|network|socket hang|handshake/i;
const retryDelay = (msg) =>
  RATE_LIMIT_RE.test(msg) ? 5000 : CONN_ISSUE_RE.test(msg) ? 3000 : 1000;

// Per-exchange params для watchLiquidations*. bybit: топик `liquidation.<sym>` снят с обслуживания
// (сервер отвечает "handler not found") — нужен `allLiquidation`.
const LIQUIDATION_PARAMS_BY_EXCHANGE = {
  bybit: { method: 'allLiquidation' },
};

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

/**
 * Резолвим только USDT-perp (swap): предпочитаем perp-нотацию, затем symbol; НИКОГДА не откатываемся
 * на spot. Копия логики resolveSymbol из watchAllTrades (index.js) — она там не экспортируется.
 */
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

// Сторона ликвидационного ордера биржи → position: buy → up, sell → down.
const sideToPosition = (side) =>
  String(side || '').toLowerCase() === 'buy' ? 'up' : 'down';

async function runExchangeLiquidations({ exCfg, upstream }) {
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

  // loadMarkets один раз — резолвим символы, определяем поддержку методов.
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

  const hasForSymbols = !!(market.has && market.has['watchLiquidationsForSymbols']);
  const hasPerSymbol = !!(market.has && market.has['watchLiquidations']);
  if (!hasForSymbols && !hasPerSymbol) {
    console.warn(`[${exchangeId}] ликвидации не поддерживаются в ccxt — пропуск`);
    try { await market.close?.(); } catch (_) {}
    return;
  }

  const streams = [];
  const skipped = [];
  for (const p of pairs) {
    const sym = resolveSymbol(market, p.symbol);
    if (!sym) {
      skipped.push(p.symbol);
      continue;
    }
    streams.push({ symbol: sym, pairId: p.pairId });
  }

  try { await market.close?.(); } catch (_) {}

  if (!streams.length) {
    console.error(`[${exchangeId}] нет валидных символов — стоп`);
    return;
  }

  const skippedNote = skipped.length ? `, skipped: ${skipped.join(', ')}` : '';
  const symbols = streams.map((s) => s.symbol);
  const pairIdBySymbol = new Map(streams.map((s) => [s.symbol, s.pairId]));
  const liqParams = LIQUIDATION_PARAMS_BY_EXCHANGE[exchangeId] || {};

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

  // Логируем и шлём в upstream ОДНУ ликвидацию. pairId резолвим по символу ликвидации.
  const forwardLiq = (liq) => {
    if (!liq) return;
    const pairId = pairIdBySymbol.get(liq.symbol);
    if (pairId == null) return;
    const position = sideToPosition(liq.side);
    const price = String(liq.price);
    const contracts = Number(liq.contracts);
    const ts = liq.timestamp;
    if (!Number.isFinite(contracts) || !Number.isFinite(ts)) return;
    const data = { pairId, tradingServiceId, position, price, contracts, ts };
    console.log(`[liq ${exchangeId}]`, JSON.stringify({ symbol: liq.symbol, ...data }));
    upstream.send('liquidation', data);
  };

  // Почему не берём возвращаемое значение watchLiquidations напрямую: у ccxt newUpdates=true
  // отдаёт лишь ОДНУ ликвидацию с последнего resolve, а client.resolve без активного ожидателя
  // просто выбрасывает результат. Значит, если в один 500мс-снапшот allLiquidation по символу
  // пришла пачка, мы бы забрали только первую. Поэтому вычитываем ВЕСЬ кэш ccxt
  // (ex.liquidations[symbol], ArrayCache), а не возвращённое значение, с per-symbol водяным знаком
  // по ts + дедупом на равном ts. Кэш держит все распарсенные записи (лимит 1000).
  const watermark = new Map(); // symbol -> { lastTs, seen:Set<key> }
  const drainSymbols = (ex, syms) => {
    const cacheBySymbol = ex && ex.liquidations;
    if (!cacheBySymbol) return;
    for (const sym of syms) {
      const cache = cacheBySymbol[sym];
      if (!cache || !cache.length) continue;
      let wm = watermark.get(sym);
      if (!wm) { wm = { lastTs: 0, seen: new Set() }; watermark.set(sym, wm); }
      for (const liq of cache) {
        const ts = Number(liq && liq.timestamp);
        if (!Number.isFinite(ts) || ts < wm.lastTs) continue;
        const key = `${ts}:${liq.price}:${liq.contracts}:${liq.side}`;
        if (ts === wm.lastTs) {
          if (wm.seen.has(key)) continue;
        } else {
          wm.lastTs = ts;
          wm.seen.clear();
        }
        wm.seen.add(key);
        forwardLiq(liq);
      }
    }
  };

  // Fast path: одно соединение на все символы.
  if (hasForSymbols) {
    console.log(
      `[${exchangeId}] watchLiquidationsForSymbols: ${symbols.length} symbols / 1 conn${skippedNote}`,
    );
    while (true) {
      try {
        const ex = ensureExchange();
        await ex.watchLiquidationsForSymbols(symbols, undefined, undefined, liqParams);
        drainSymbols(ex, symbols);
      } catch (err) {
        const msg = errMsg(err);
        console.error(`[${exchangeId}] liquidations: ${msg}`);
        resetExchange();
        await sleep(retryDelay(msg));
      }
    }
  }

  // Fallback: по циклу на символ.
  console.log(
    `[${exchangeId}] watchLiquidations: ${symbols.length} streams${skippedNote}`,
  );
  const streamLoop = async (symbol) => {
    while (true) {
      try {
        const ex = ensureExchange();
        await ex.watchLiquidations(symbol, undefined, undefined, liqParams);
        drainSymbols(ex, [symbol]);
      } catch (err) {
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
  const maxStreamsPerConn =
    Number(process.env.MAX_STREAMS_PER_CONN) ||
    Number(config.maxStreamsPerConn) ||
    undefined;
  const subscribeDelayMs =
    Number(process.env.SUBSCRIBE_DELAY_MS) ||
    Number(config.subscribeDelayMs) ||
    undefined;

  const { positional, debug } = parseArgs(process.argv);
  if (debug) setDebugName(debug);

  const exArg = positional[0] || process.env.EXCHANGE;
  if (!exArg) {
    throw new Error(
      'Usage: node all-liquidations.js <exchange> [i/n]  (напр. node all-liquidations.js bybit  |  node all-liquidations.js phemex 1/3)',
    );
  }
  const serviceNames = selectServices(exArg, tradingServices);

  const shardSpec = positional[1] || process.env.SUBSHARD;
  if (shardSpec && serviceNames.length > 1) {
    throw new Error('Sub-shard (i/n) поддерживается только для одной биржи');
  }
  const shardNames = sliceNames(names, shardSpec);

  const entries = serviceNames.map((sname) => ({
    tradingServiceId: tradingServices[sname],
    names: shardNames,
    maxStreamsPerConn,
    subscribeDelayMs,
  }));

  console.log(
    `[start] liquidations exchange-shard: ${serviceNames.join(', ')} × ${shardNames.length} pairs` +
      (shardSpec ? ` (sub-shard ${shardSpec})` : ''),
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
    exchanges.map((exCfg) => runExchangeLiquidations({ exCfg, upstream })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
