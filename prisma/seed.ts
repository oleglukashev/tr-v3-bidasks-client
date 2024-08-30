import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Role
  const mexcTradingService = await prisma.tradingService.create({
    data: { name: 'Mexc' },
  });

  const topMexPairs = [
    'BTCUSDT',
    'ETHUSDT',
    'KASUSDT',
    'MANTAUSDT',
    'STRKUSDT',
    'WUSDT',
    'TONUSDT',
    'XRPUSDT',
    'XCHUSDT',
    'TRXUSDT',
    'RONUSDT',
    'TIAUSDT',
    'PEPE',
    'SUIUSDT',
    'OPUSDT',
    'ATOMUSDT',
    'ICPUSDT',
    'XMRUSDT',
    'SOLUSDT',
    'ENAUSDT',
    'ARBUSDT',
    'DOGEUSDT',
    'ADAUSDT',
    'AVAXUSDT',
    'DOTUSDT',
    'LINKUSDT',
  ];

  for (const pair of topMexPairs) {
    await prisma.pair.create({
      data: {
        name: pair,
        symbol: pair,
        tradingServiceId: mexcTradingService.id,
      },
    });
    await prisma.balance.create({
      data: { symbol: pair.replace('USDT', '') },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
