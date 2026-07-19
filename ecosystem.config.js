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

// bybit — multiplex (watchTradesForSymbols): одно ws-соединение на все монеты.
// Разбивать на подшарды нужно только для тяжёлых single-symbol бирж (mexc/gate/htx/bingx/phemex).
module.exports = {
  apps: [
    { ...common, name: 'bybit', args: 'bybit' },
    // { ...common, name: 'okx', args: 'okx' },
    // { ...common, name: 'kucoin', args: 'kucoin' },
    // { ...common, name: 'bitget', args: 'bitget' },
    // { ...common, name: 'bingx', args: 'bingx' },
    // { ...common, name: 'phemex1', args: 'phemex 1/3' },
    // { ...common, name: 'phemex2', args: 'phemex 2/3' },
    // { ...common, name: 'phemex3', args: 'phemex 3/3' },
  ],
};
