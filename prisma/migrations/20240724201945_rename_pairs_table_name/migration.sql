/*
  Warnings:

  - You are about to drop the `currency_pairs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "currency_pairs" DROP CONSTRAINT "currency_pairs_trading_service_id_fkey";

-- DropForeignKey
ALTER TABLE "klines" DROP CONSTRAINT "klines_pair_id_fkey";

-- DropForeignKey
ALTER TABLE "strategy_sessions" DROP CONSTRAINT "strategy_sessions_pair_id_fkey";

-- DropTable
DROP TABLE "currency_pairs";

-- CreateTable
CREATE TABLE "pairs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(50) NOT NULL,
    "current_ts" INTEGER NOT NULL DEFAULT 0,
    "trading_service_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pairs_name_key" ON "pairs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pairs_symbol_key" ON "pairs"("symbol");

-- AddForeignKey
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_trading_service_id_fkey" FOREIGN KEY ("trading_service_id") REFERENCES "trading_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "klines" ADD CONSTRAINT "klines_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_sessions" ADD CONSTRAINT "strategy_sessions_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
