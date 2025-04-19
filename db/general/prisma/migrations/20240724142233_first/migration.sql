-- CreateTable
CREATE TABLE "trading_services" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_pairs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "trading_service_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "klines" (
    "id" TEXT NOT NULL,
    "open" VARCHAR(50) NOT NULL,
    "close" VARCHAR(50) NOT NULL,
    "low" VARCHAR(50) NOT NULL,
    "high" VARCHAR(50) NOT NULL,
    "ts" INTEGER NOT NULL,
    "pair_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "klines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balances" (
    "id" SERIAL NOT NULL,
    "currency" VARCHAR(50) NOT NULL,
    "value" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_sessions" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pair_id" INTEGER NOT NULL,
    "start_ts" INTEGER NOT NULL,
    "finish_ts" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_session_trxs" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "value" VARCHAR(50) NOT NULL,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" VARCHAR(50) NOT NULL,
    "price" VARCHAR(50) NOT NULL,
    "strategy_session_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_session_trxs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trading_services_name_key" ON "trading_services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "currency_pairs_code_key" ON "currency_pairs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currency_pairs_name_key" ON "currency_pairs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "klines_id_key" ON "klines"("id");

-- CreateIndex
CREATE UNIQUE INDEX "klines_ts_pair_id_key" ON "klines"("ts", "pair_id");

-- CreateIndex
CREATE UNIQUE INDEX "balances_currency_key" ON "balances"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "strategies_name_key" ON "strategies"("name");

-- AddForeignKey
ALTER TABLE "currency_pairs" ADD CONSTRAINT "currency_pairs_trading_service_id_fkey" FOREIGN KEY ("trading_service_id") REFERENCES "trading_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "klines" ADD CONSTRAINT "klines_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "currency_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_sessions" ADD CONSTRAINT "strategy_sessions_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "currency_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_session_trxs" ADD CONSTRAINT "strategy_session_trxs_strategy_session_id_fkey" FOREIGN KEY ("strategy_session_id") REFERENCES "strategy_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
