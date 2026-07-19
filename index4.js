'use strict';

/**
 * Exchange-sharded trade relay (архитектурно-оптимизированный вариант index.js).
 *
 * index.js:  1 процесс = чанк монет × ВСЕ биржи  → каждый чанк переподключается к каждой бирже
 *            (дублирующие соединения) и заново гоняет loadMarkets на биржу.
 * index4.js: 1 процесс = ОДНА биржа × ВСЕ монеты → одна точка владеет каждой биржей:
 *            - multiplex-биржи используют ОДИН ws на все символы (без per-chunk fan-out);
 *            - loadMarkets один раз на биржу (а не chunk × биржа);
 *            - rate-limit / падение одной биржи не трогает остальные (blast-radius isolation);
 *            - per-exchange тюнинг (subscribe delay) естественен.
 *
 * Тяжёлые single-symbol биржи (mexc/gate/htx/bingx/phemex открывают 1 ws на символ) можно разбить
 * на несколько процессов опциональным подшардом "i/n", оставаясь в пределах per-IP лимита биржи.
 *
 * Движок сбора (resolve символов, watch-циклы, upstream ws) переиспользуется из index.js через
 * module.exports — этот файл меняет только ось шардинга в main().
 *
 * Usage:
 *   node index4.js <exchange> [i/n]
 *     node index4.js bybit         → bybit, все монеты (1 multiplexed ws)
 *     node index4.js bybit,okx     → несколько лёгких multiplex-бирж в одном процессе
 *     node index4.js phemex 1/3    → phemex, подшард 1 из 3 монет
 *     node index4.js all           → каждая биржа в одном процессе (все монеты)
 *
 * Env: как у index.js (BIDASKS_API_URL, BIDASKS_UPSTREAM_WS_URL, MAX_STREAMS_PER_CONN, ...),
 *      плюс EXCHANGE и SUBSHARD как альтернатива позиционным аргументам.
 */

require('dns').setDefaultResultOrder('ipv4first');

const {
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
} = require('./index.js');

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
      'Usage: node index4.js <exchange> [i/n] [--debug NAME]  (напр. node index4.js bybit  |  node index4.js phemex 1/3  |  node index4.js bybit --debug KASUSDT)',
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
    `[start] exchange-shard: ${serviceNames.join(', ')} × ${shardNames.length} pairs` +
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

  const lastRecvTs = new Map();
  startWatchdog(lastRecvTs);

  await Promise.all(
    exchanges.map((exCfg) => runExchange({ exCfg, upstream, lastRecvTs })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
