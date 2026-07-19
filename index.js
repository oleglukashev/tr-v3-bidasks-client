'use strict';

/**
 * Multi-exchange (CCXT Pro) trade relay → один общий upstream WS (tr-v3-bidasks).
 * Сбор через watchTrades / watchTradesForSymbols. Каждый апдейт шлётся как
 *   { type: 'trades', data: { pairId, tradingServiceId, trades: [{ ts, price, amount, side }] } }
 * в сокет tr-v3-bidasks, который строит из трейдов bid/ask-кластеры и xv-range бары (+ footprint).
 *
 * В отличие от orderbook-релея здесь НЕ троттлим и НЕ обрезаем — для кластеров/xv нужен каждый
 * трейд целиком. Глубины стакана / crossed-guard нет; вместо них — множитель contractSize
 * (деривативы отдают объём в контрактах, приводим к базовой монете).
 *
 * Пары делятся на чанки по chunkSize (configs/base.json). Один процесс = ОДИН чанк по нескольким биржам:
 *   node index.js <chunkNumber> [services]
 *     node index.js 1            → чанк 1, ВСЕ trading services
 *     node index.js 2 bybit,okx  → чанк 2, только bybit и okx
 * Имена чанка резолвятся через tr-v3-api:
 *   GET {BIDASKS_API_URL}/exchanges/{tradingServiceId}/pairs-by-names?names=NAME1,NAME2
 *
 * Env: BIDASKS_CLIENT_CONFIG, BIDASKS_API_URL, CHUNK, TRADING_SERVICES,
 *      MAX_STREAMS_PER_CONN, SUBSCRIBE_DELAY_MS, BIDASKS_UPSTREAM_WS_URL, UPSTREAM_RECONNECT_MS.
 */

// Prefer IPv4: этот бокс имеет битый/недоступный IPv6, но bybit (CloudFront) и okx (Cloudflare)
// публикуют AAAA — Node сначала пробует IPv6 и WS тихо умирает. ipv4first чинит.
require('dns').setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const ccxt = require('ccxt');

const SILENCE_TIMEOUT_MS = 120_000;
const WATCHDOG_CHECK_INTERVAL_MS = 60_000;
const WATCHDOG_ALERT_AFTER_MS = SILENCE_TIMEOUT_MS * 2;
// Multiplexed mode: если ОДИН символ молчит так долго, а соединение живо (биржа тихо сбросила
// подписку), форсируем полный ресабскрайб.
const SYMBOL_STALE_MS = 180_000;

/** Если сервер не ответил { subscription: true }, закрываем сокет и уходим в reconnect */
const SUBSCRIBE_ACK_TIMEOUT_MS = 30_000;

// Exchanges whose USDT-perp markets live in a different ccxt class than the ccxtId.
const CCXT_FUTURES_ID = {
  kucoin: 'kucoinfutures',
};

const RATE_LIMIT_RE = /too frequent|too many|rate ?limit|frequently|\b429\b|\b510\b/i;

// Per-exchange minimum gap between subscribe frames (ms). mexc строгий (код 510 "too frequent").
// Эффективный gap = max(config subscribeDelayMs, this).
const SUBSCRIBE_DELAY_MS_BY_EXCHANGE = {
  mexc: 1000,
  gate: 300,
  bitget: 300,
};

// Error classifiers (shared by both collection loops).
const isRateLimit = (m) => RATE_LIMIT_RE.test(m || '');
// Connection/keepalive problems → back off чуть дольше (не долбим мёртвый сокет каждую 1с).
const CONN_ISSUE_RE = /timed out|connection|keepalive|econn|network|socket hang|handshake/i;
const errMsg = (err) => (err && (err.message || err.name)) || String(err) || 'unknown';
const retryDelay = (msg) =>
  isRateLimit(msg) ? 5000 : CONN_ISSUE_RE.test(msg) ? 3000 : 1000;

const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;

// Optional debug: печатать каждый батч трейдов, отправляемый апстриму, но только для одной пары.
// Имя задаётся через `--debug KASUSDT` / `--debug=KASUSDT` или env BIDASKS_DEBUG. null — выключено.

// Пары из API приходят как ccxt-символы (ADA/USDT:USDT), а --debug задаётся компактным именем
// (ADAUSDT). Приводим обе стороны к одному виду.
const normPairName = (s) =>
  String(s || '').toUpperCase().split(':')[0].replace(/[^A-Z0-9]/g, '');

let DEBUG_NAME = process.env.BIDASKS_DEBUG
  ? normPairName(process.env.BIDASKS_DEBUG)
  : null;

/**
 * Достаёт `--debug <name>` / `--debug=<name>` из argv и возвращает остальные позиционные аргументы,
 * чтобы флаг можно было ставить в любом месте, не ломая позиционный разбор.
 */
function parseArgs(argv) {
  const positional = [];
  let debug = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--debug') {
      debug = argv[i + 1] || null;
      i++;
    } else if (a.startsWith('--debug=')) {
      debug = a.slice('--debug='.length) || null;
    } else {
      positional.push(a);
    }
  }
  return { positional, debug };
}

/** Включить дебаг-вывод для пары `name` (используется и index.js, и index4.js). */
function setDebugName(name) {
  if (name) {
    DEBUG_NAME = normPairName(name);
    console.log(`[debug] печатаю трейды, отправляемые по вебсокету, для пары ${DEBUG_NAME}`);
  }
}

function loadConfig() {
  const configPath =
    process.env.BIDASKS_CLIENT_CONFIG ||
    path.join(__dirname, 'configs', 'base.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function selectChunk(names, size, chunkNumber) {
  const chunks = [];
  for (let i = 0; i < names.length; i += size) {
    chunks.push(names.slice(i, i + size));
  }
  if (!Number.isInteger(chunkNumber) || chunkNumber < 1 || chunkNumber > chunks.length) {
    throw new Error(
      `Номер чанка ${chunkNumber} вне диапазона 1..${chunks.length} (всего пар: ${names.length}, по ${size})`,
    );
  }
  return { chunk: chunks[chunkNumber - 1], total: chunks.length };
}

function selectServices(arg, tradingServices) {
  const all = Object.keys(tradingServices);
  const value = (arg || 'all').trim().toLowerCase();
  if (value === 'all') return all;
  const picked = value.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = picked.filter((s) => !(s in tradingServices));
  if (unknown.length) {
    throw new Error(
      `Неизвестные trading services: ${unknown.join(', ')}. Доступны: ${all.join(', ')}`,
    );
  }
  return picked;
}

class UpstreamWs {
  constructor(wsUrl, reconnectMs) {
    this.wsUrl = wsUrl;
    this.reconnectMs = reconnectMs;
    this.ws = null;
    this.closed = false;
    this.subscribed = false;
    this._reconnectTimer = null;
    this._subscribeAckTimer = null;
    this._activeSocket = null;
    this._pingTimer = null;
    this._pongTimer = null;
  }

  start() {
    this.closed = false;
    this._clearReconnectTimer();
    this._connect();
  }

  stop() {
    this.closed = true;
    this._clearReconnectTimer();
    this._clearSubscribeAckTimer();
    this._clearPingPong();
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this._activeSocket = null;
    this.subscribed = false;
  }

  _clearPingPong() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
    if (this._pongTimer) {
      clearTimeout(this._pongTimer);
      this._pongTimer = null;
    }
  }

  _startPing(ws) {
    this._clearPingPong();
    this._pingTimer = setInterval(() => {
      if (this.closed || this._activeSocket !== ws) {
        this._clearPingPong();
        return;
      }
      if (ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.ping();
      } catch (_) {
        return;
      }
      this._pongTimer = setTimeout(() => {
        if (this.closed || this._activeSocket !== ws) return;
        console.warn('[upstream] pong timeout, closing socket');
        try { ws.terminate(); } catch (_) {}
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);

    ws.on('pong', () => {
      if (this._pongTimer) {
        clearTimeout(this._pongTimer);
        this._pongTimer = null;
      }
    });
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _clearSubscribeAckTimer() {
    if (this._subscribeAckTimer) {
      clearTimeout(this._subscribeAckTimer);
      this._subscribeAckTimer = null;
    }
  }

  _scheduleReconnect(reason) {
    if (this.closed) return;
    if (this._reconnectTimer) return;
    const msg = reason ? `${reason}, ` : '';
    console.warn(`[upstream] ${msg}reconnect in ${this.reconnectMs}ms (exchange streams unaffected)`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      console.log('[upstream] attempting to reconnect...');
      this._connect();
    }, this.reconnectMs);
  }

  _connect() {
    if (this.closed) return;

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close();
        }
      } catch (_) {}
      this.ws = null;
    }

    this.subscribed = false;
    this._clearSubscribeAckTimer();

    console.log(`[upstream] connecting to ${this.wsUrl}`);

    let ws;
    try {
      ws = new WebSocket(this.wsUrl);
    } catch (err) {
      console.error('[upstream] failed to create socket:', err.message);
      this._scheduleReconnect('connect failed');
      return;
    }

    this.ws = ws;
    this._activeSocket = ws;

    ws.on('open', () => {
      if (this.closed || this._activeSocket !== ws) return;
      console.log('[upstream] socket open:', this.wsUrl);
      this._startPing(ws);
      try {
        ws.send(JSON.stringify({ type: 'subscribeTradeClients' }));
        console.log("[upstream] sent { type: 'subscribeTradeClients' }");
      } catch (err) {
        console.error('[upstream] subscribe send error:', err.message);
        try { ws.close(); } catch (_) {}
        return;
      }
      this._subscribeAckTimer = setTimeout(() => {
        if (this.closed || this._activeSocket !== ws || this.subscribed) return;
        console.warn(
          `[upstream] no { subscription: true } within ${SUBSCRIBE_ACK_TIMEOUT_MS / 1000}s, closing`,
        );
        try { ws.close(); } catch (_) {}
      }, SUBSCRIBE_ACK_TIMEOUT_MS);
    });

    ws.on('message', (raw) => {
      if (this.closed || this._activeSocket !== ws) return;
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_) {
        return;
      }
      if (msg && msg.subscription === true) {
        if (!this.subscribed) {
          this._clearSubscribeAckTimer();
          this.subscribed = true;
          console.log('[upstream] subscription confirmed: { subscription: true }');
        }
      }
    });

    ws.on('error', (err) => {
      console.error('[upstream] socket error:', err.message);
    });

    ws.on('close', (code, reason) => {
      if (this._activeSocket === ws) this._activeSocket = null;
      if (this.ws === ws) this.ws = null;
      this.subscribed = false;
      this._clearSubscribeAckTimer();
      this._clearPingPong();
      const reasonStr = reason ? reason.toString() : '';
      if (!this.closed) {
        console.warn(`[upstream] connection closed: ${code} ${reasonStr || ''}`.trim());
        this._scheduleReconnect('disconnected');
      }
    });
  }

  /**
   * @param {number} pairId
   * @param {number} tradingServiceId
   * @param {Array<{ts:number,price:number,amount:number,side:string}>} trades
   */
  sendTrades(pairId, tradingServiceId, trades) {
    if (!trades || !trades.length) return;
    if (!this.subscribed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload = {
      type: 'trades',
      data: { pairId, tradingServiceId, trades },
    };
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[upstream] send error:', err.message);
    }
  }
}

/** Раз в минуту предупреждаем, если по символу давно не было трейдов. */
function startWatchdog(lastRecvTs) {
  setInterval(() => {
    const now = Date.now();
    for (const [symbol, ts] of lastRecvTs) {
      const silenceMs = now - ts;
      if (silenceMs > WATCHDOG_ALERT_AFTER_MS) {
        console.warn(`[Watchdog] No trades for ${symbol} in ${Math.round(silenceMs / 1000)}s`);
      }
    }
  }, WATCHDOG_CHECK_INTERVAL_MS);
}

// ---- config resolve via tr-v3-api (retry + bounded concurrency) ----

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CONFIG_FETCH_CONCURRENCY = Number(process.env.CONFIG_FETCH_CONCURRENCY) || 3;
const CONFIG_FETCH_RETRIES = Number(process.env.CONFIG_FETCH_RETRIES) || 5;
const CONFIG_FETCH_TIMEOUT_MS = Number(process.env.CONFIG_FETCH_TIMEOUT_MS) || 15000;
const CONFIG_FETCH_BACKOFF_MS = Number(process.env.CONFIG_FETCH_BACKOFF_MS) || 1000;

async function fetchJsonWithRetry(url, label) {
  let lastErr;
  for (let attempt = 1; attempt <= CONFIG_FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Connection: 'keep-alive' },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      const reason = err.name === 'AbortError' ? `timeout ${CONFIG_FETCH_TIMEOUT_MS}ms` : err.message;
      if (attempt < CONFIG_FETCH_RETRIES) {
        const backoff = CONFIG_FETCH_BACKOFF_MS * 2 ** (attempt - 1);
        console.warn(`[config] ${label}: attempt ${attempt}/${CONFIG_FETCH_RETRIES} failed (${reason}); retry in ${backoff}ms`);
        await sleep(backoff);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${label}: failed after ${CONFIG_FETCH_RETRIES} attempts: ${lastErr && lastErr.message}`);
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchExchangeByNames(apiUrl, tradingServiceId, names) {
  const base = String(apiUrl).replace(/\/+$/, '');
  const url = `${base}/exchanges/${tradingServiceId}/pairs-by-names?names=${encodeURIComponent(names.join(','))}`;
  console.log(`[config] resolving TS=${tradingServiceId} (${names.length} names) via ${base}`);
  return fetchJsonWithRetry(url, `pairs-by-names TS=${tradingServiceId}`);
}

async function resolveExchangeEntry(entry, apiUrl) {
  if (!apiUrl) throw new Error('apiUrl (BIDASKS_API_URL) обязателен');
  if (entry.tradingServiceId == null) throw new Error('запись требует tradingServiceId');
  const resolved = await fetchExchangeByNames(apiUrl, entry.tradingServiceId, entry.names);
  return {
    tradingServiceId: resolved.tradingServiceId,
    id: resolved.id, // ccxtId
    defaultType: resolved.defaultType,
    pairs: resolved.pairs,
    options: entry.options ?? {},
    maxStreamsPerConn: entry.maxStreamsPerConn,
    subscribeDelayMs: entry.subscribeDelayMs,
  };
}

// ---- collection ----

/**
 * Один шард = одно ws-соединение (свой ccxt-инстанс) на набор символов.
 * multiplexed=true → один цикл `watchTradesForSymbols` на все символы (bybit/okx/kucoin/bitget),
 * иначе — по циклу `watchTrades` на символ.
 */
async function runShard({ label, exchangeId, tradingServiceId, createExchange, streams, upstream, lastRecvTs, wk, subscribeDelayMs, multiplexed }) {
  const gapMs = Math.max(
    Number(subscribeDelayMs) || 200,
    SUBSCRIBE_DELAY_MS_BY_EXCHANGE[exchangeId] || 0,
  );
  let gateChain = Promise.resolve();
  const subscribeGate = () => {
    gateChain = gateChain.then(() => new Promise((r) => setTimeout(r, gapMs)));
    return gateChain;
  };

  let shared = null;
  let creating = null;
  const ensureExchange = () => {
    if (shared) return Promise.resolve(shared);
    if (!creating) {
      creating = (async () => {
        const ex = createExchange();
        await ex.loadMarkets();
        shared = ex;
        creating = null;
        return ex;
      })().catch((e) => {
        creating = null;
        throw e;
      });
    }
    return creating;
  };
  const resetExchange = (ex) => {
    const old = shared;
    if (ex == null || old === ex) {
      shared = null;
      try { old?.close?.()?.catch?.(() => {}); } catch (_) {}
    }
  };

  let lastAny = Date.now();
  setInterval(() => {
    if (Date.now() - lastAny > SILENCE_TIMEOUT_MS) {
      console.warn(`[${label}] no data ${Math.round((Date.now() - lastAny) / 1000)}s — reconnect`);
      lastAny = Date.now();
      resetExchange(null);
    }
  }, WATCHDOG_CHECK_INTERVAL_MS);

  // contractSize per symbol — деривативы отдают объём в контрактах; переводим в базовые монеты.
  const csBySymbol = new Map(streams.map((s) => [s.symbol, s.contractSize || 1]));
  // resolved symbol (KAS/USDT:USDT) → исходное имя (KASUSDT) для матчинга --debug.
  const origBySymbol = new Map(streams.map((s) => [s.symbol, s.origSymbol || s.symbol]));

  // Приводим ccxt-трейды к компактному виду, ожидаемому сервером (processTrade):
  // { ts(ms), price(Number), amount(base coins), side('buy'|'sell') }.
  const normTrades = (trades, cs) => {
    const out = [];
    for (const t of trades) {
      if (t == null) continue;
      const price = Number(t.price);
      const amount = Number(t.amount) * cs;
      if (!Number.isFinite(price) || !Number.isFinite(amount)) continue;
      out.push({
        ts: t.timestamp,
        price,
        amount,
        side: String(t.side || '').toLowerCase(),
      });
    }
    return out;
  };

  const forward = (trades, pairId, sym) => {
    if (!trades || !trades.length) return;
    const cs = csBySymbol.get(sym) || 1;
    const norm = normTrades(trades, cs);
    if (!norm.length) return;
    if (DEBUG_NAME && normPairName(origBySymbol.get(sym)) === DEBUG_NAME) {
      console.log(
        `[debug ${DEBUG_NAME}] ${label} → ` +
          JSON.stringify({ type: 'trades', data: { pairId, tradingServiceId, trades: norm } }),
      );
    }
    upstream.sendTrades(pairId, tradingServiceId, norm);
  };

  // Single-connection loop for all symbols (fewer awaits / connections / event-loop load).
  const multiplexedLoop = async () => {
    const symbols = streams.map((s) => s.symbol);
    const pairIdBySymbol = Object.create(null);
    for (const s of streams) pairIdBySymbol[s.symbol] = s.pairId;

    // Per-symbol receive time: один сдохший символ не тронет connection-level watchdog
    // (остальные держат соединение), поэтому ловим здесь и форсируем полный ресабскрайб.
    const lastRecv = new Map(symbols.map((s) => [s, Date.now()]));
    setInterval(() => {
      const now = Date.now();
      let stale = null;
      for (const [s, t] of lastRecv) {
        if (now - t > SYMBOL_STALE_MS) {
          stale = s;
          break;
        }
      }
      if (stale) {
        console.warn(
          `[${label}] symbol ${stale} silent ${Math.round((now - lastRecv.get(stale)) / 1000)}s — resubscribe all`,
        );
        for (const s of symbols) lastRecv.set(s, now);
        resetExchange(null);
      }
    }, WATCHDOG_CHECK_INTERVAL_MS);

    while (true) {
      try {
        const ex = await ensureExchange();
        // watchTradesForSymbols возвращает массив трейдов для символа, который тикнул.
        const trades = await ex.watchTradesForSymbols(symbols);
        const now = Date.now();
        lastAny = now;
        if (!trades || !trades.length) continue;
        // Группируем по символу (обычно один, но подстрахуемся).
        const bySym = new Map();
        for (const t of trades) {
          const arr = bySym.get(t.symbol);
          if (arr) arr.push(t);
          else bySym.set(t.symbol, [t]);
        }
        for (const [sym, arr] of bySym) {
          const pairId = pairIdBySymbol[sym];
          if (pairId == null) continue;
          lastRecv.set(sym, now);
          lastRecvTs.set(wk(sym), now);
          forward(arr, pairId, sym);
        }
      } catch (err) {
        const msg = errMsg(err);
        console.error(`[${label}] multiplexed: ${msg}`);
        await sleep(retryDelay(msg));
      }
    }
  };

  // One loop per symbol (fallback for exchanges without watchTradesForSymbols).
  const streamLoop = async (sub) => {
    const key = wk(sub.symbol);
    let subscribed = false;
    while (true) {
      try {
        const ex = await ensureExchange();
        if (!subscribed) await subscribeGate();
        const trades = await ex.watchTrades(sub.symbol);
        subscribed = true;
        const now = Date.now();
        lastAny = now;
        lastRecvTs.set(key, now);
        forward(trades, sub.pairId, sub.symbol);
      } catch (err) {
        subscribed = false;
        const msg = errMsg(err);
        console.error(`[${label}] ${sub.symbol}: ${msg}`);
        await sleep(retryDelay(msg));
      }
    }
  };

  if (multiplexed) {
    await multiplexedLoop();
  } else {
    await Promise.all(streams.map(streamLoop));
  }
}

async function watchAllTrades({ exchangeId, tradingServiceId, createExchange, pairs, upstream, lastRecvTs, maxStreamsPerConn, subscribeDelayMs }) {
  const wk = (symbol) => `${exchangeId}:${symbol}`;
  const MAX = Math.max(1, Number(maxStreamsPerConn) || 90);

  let market = null;
  while (true) {
    try {
      market = createExchange();
      await market.loadMarkets();
      break;
    } catch (e) {
      console.error(`[${exchangeId}] connect: ${e.message}`);
      try { await market?.close?.(); } catch (_) {}
      market = null;
      await sleep(2000);
    }
  }

  // Резолвим только USDT-perp (swap): предпочитаем perp-нотацию, затем symbol; НИКОГДА не откатываемся
  // на spot (там другой тик/объёмы).
  const resolveSymbol = (p) => {
    const perp = (p.symbol || '').replace('USDT', '/USDT:USDT');
    for (const cand of [perp, p.symbol]) {
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
  };

  const supportsMulti = !!(market.has && market.has['watchTradesForSymbols']);

  const streams = [];
  const skipped = [];
  for (const p of pairs) {
    const sym = resolveSymbol(p);
    if (!sym) {
      skipped.push(p.symbol);
      continue;
    }
    lastRecvTs.set(wk(sym), Date.now());
    const cs = Number(market.markets[sym] && market.markets[sym].contractSize);
    streams.push({
      symbol: sym,
      origSymbol: p.symbol,
      pairId: p.pairId,
      contractSize: cs > 0 ? cs : 1,
    });
  }

  try { await market.close?.(); } catch (_) {}

  if (!streams.length) {
    console.error(`[${exchangeId}] нет валидных символов — стоп`);
    return;
  }

  const skippedNote = skipped.length ? `, skipped: ${skipped.join(', ')}` : '';

  // Fast path: одно соединение на все символы.
  if (supportsMulti && streams.length > 1) {
    console.log(
      `[${exchangeId}] watchTradesForSymbols: ${streams.length} symbols / 1 conn${skippedNote}`,
    );
    await runShard({
      label: exchangeId,
      exchangeId,
      tradingServiceId,
      createExchange,
      streams,
      upstream,
      lastRecvTs,
      wk,
      subscribeDelayMs,
      multiplexed: true,
    });
    return;
  }

  // Fallback: per-symbol streams, sharded by maxStreamsPerConn.
  const shards = [];
  for (let i = 0; i < streams.length; i += MAX) {
    shards.push(streams.slice(i, i + MAX));
  }

  console.log(
    `[${exchangeId}] watchTrades: ${streams.length} streams / ${shards.length} conn(s)${skippedNote}`,
  );

  await Promise.all(
    shards.map((shard, idx) =>
      runShard({
        label: shards.length > 1 ? `${exchangeId}#${idx + 1}` : exchangeId,
        exchangeId,
        tradingServiceId,
        createExchange,
        streams: shard,
        upstream,
        lastRecvTs,
        wk,
        subscribeDelayMs,
        multiplexed: false,
      }),
    ),
  );
}

async function runExchange({ exCfg, upstream, lastRecvTs }) {
  const exchangeId = exCfg.id;
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

  // Public market data only — no API keys (трейды не требуют auth).
  const createExchange = () =>
    new ExchangeClass({
      enableRateLimit: true,
      options: {
        defaultType: exCfg.defaultType ?? 'linear',
        ...(exCfg.options ?? {}),
      },
    });

  await watchAllTrades({
    exchangeId,
    tradingServiceId: exCfg.tradingServiceId,
    createExchange,
    pairs,
    upstream,
    lastRecvTs,
    maxStreamsPerConn: exCfg.maxStreamsPerConn,
    subscribeDelayMs: exCfg.subscribeDelayMs,
  });
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
  const chunkSize = Number(config.chunkSize) || 20;
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
  if (debug) setDebugName(debug); // флаг переопределяет env
  else if (DEBUG_NAME) {
    console.log(`[debug] печатаю трейды, отправляемые по вебсокету, для пары ${DEBUG_NAME}`);
  }

  const chunkNumber = Number(positional[0] || process.env.CHUNK);
  if (!Number.isFinite(chunkNumber)) {
    throw new Error(
      'Usage: node index.js <chunkNumber> [services] [--debug NAME]  (напр. node index.js 1  |  node index.js 2 bybit,okx  |  node index.js 1 bybit --debug KASUSDT)',
    );
  }
  const { chunk, total } = selectChunk(names, chunkSize, chunkNumber);
  const serviceNames = selectServices(
    positional[1] || process.env.TRADING_SERVICES,
    tradingServices,
  );

  const entries = serviceNames.map((sname) => ({
    tradingServiceId: tradingServices[sname],
    names: chunk,
    maxStreamsPerConn,
    subscribeDelayMs,
  }));

  console.log(
    `[start] chunk ${chunkNumber}/${total} (${chunk.length} pairs) × services: ${serviceNames.join(', ')}`,
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

  const lastRecvTs = new Map();
  startWatchdog(lastRecvTs);

  await Promise.all(
    exchanges.map((exCfg) => runExchange({ exCfg, upstream, lastRecvTs })),
  );
}

// Chunk-sharded entrypoint запускаем только при прямом вызове. Когда файл требует другой модуль
// (index4.js), просто экспортируем движок ниже.
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// Reusable engine for alternative entrypoints (index4.js — exchange-sharded).
module.exports = {
  loadConfig,
  selectServices,
  mapWithConcurrency,
  resolveExchangeEntry,
  runExchange,
  UpstreamWs,
  startWatchdog,
  CONFIG_FETCH_CONCURRENCY,
  parseArgs,
  setDebugName,
};
