/*
  Warnings:

  - A unique constraint covering the columns `[interval,pair_id]` on the table `klines` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "klines_interval_pair_id_key" ON "klines"("interval", "pair_id");
