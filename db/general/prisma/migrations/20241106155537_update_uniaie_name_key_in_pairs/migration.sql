/*
  Warnings:

  - A unique constraint covering the columns `[name,trading_service_id]` on the table `pairs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[symbol,trading_service_id]` on the table `pairs` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "pairs_name_key";

-- DropIndex
DROP INDEX "pairs_symbol_key";

-- CreateIndex
CREATE UNIQUE INDEX "pairs_name_trading_service_id_key" ON "pairs"("name", "trading_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "pairs_symbol_trading_service_id_key" ON "pairs"("symbol", "trading_service_id");
