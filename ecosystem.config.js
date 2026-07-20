// PM2 config. Запуск: pm2 start ecosystem.config.js
//   один процесс = одна биржа (по умолчанию все монеты) через exchange-sharded index4.js.
// Точечно: pm2 start ecosystem.config.js --only bybit1
//
// args = "<exchange> [i/n]"  →  "bybit"  или  "phemex 1/3"
// Env по желанию: BIDASKS_API_URL, BIDASKS_UPSTREAM_WS_URL, SUBSCRIBE_DELAY_MS, MAX_STREAMS_PER_CONN.
//
// Пока bidasks строит xv/cluster только для bybit (tradingServiceId=2), держим включённым bybit.
// Остальные биржи оставлены закомментированными — раскомментировать по мере готовности сервера.

const common = {
  script: 'index4.js',
  cwd: __dirname,
  autorestart: true,
  max_restarts: 50,
  restart_delay: 5000,
  env: {
    // BIDASKS_API_URL: 'http://api.traken-trade.ru/api/v1', // иначе apiUrl из configs/base.json
    // BIDASKS_UPSTREAM_WS_URL: 'ws://bidasks.traken-trade.ru/ws/',
  },
};

// bybit/kucoin — multiplex (watchTradesForSymbols): одно ws-соединение на все монеты.
// Разбивать на подшарды нужно только для тяжёлых single-symbol бирж (mexc/gate/htx/bingx/phemex).
//
// mexc: watchTradesForSymbols НЕ поддерживает — по одному ws на символ (30 монет = 30 сокетов),
// плюс собственный минимальный интервал подписки 1000мс (см. SUBSCRIBE_DELAY_MS_BY_EXCHANGE
// в index.js — config subscribeDelayMs его не переопределяет). Одним процессом подписка на все
// 30 символов заняла бы ~30с, поэтому три подшарда по 10.
module.exports = {
  apps: [
    { ...common, name: 'bybit', args: 'bybit' },
    { ...common, name: 'kucoin', args: 'kucoin' },
    { ...common, name: 'mexc1', args: 'mexc 1/3' },
    { ...common, name: 'mexc2', args: 'mexc 2/3' },
    { ...common, name: 'mexc3', args: 'mexc 3/3' },
    // { ...common, name: 'okx', args: 'okx' },
    // { ...common, name: 'bitget', args: 'bitget' },
    // { ...common, name: 'bingx', args: 'bingx' },
    // { ...common, name: 'phemex1', args: 'phemex 1/3' },
    // { ...common, name: 'phemex2', args: 'phemex 2/3' },
    // { ...common, name: 'phemex3', args: 'phemex 3/3' },
  ],
};
