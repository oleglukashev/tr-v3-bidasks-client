/*
  Warnings:

  - A unique constraint covering the columns `[ts,pair_id,interval]` on the table `klines` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "klines_ts_pair_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "klines_ts_pair_id_interval_key" ON "klines"("ts", "pair_id", "interval");
